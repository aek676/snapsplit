data "oci_objectstorage_namespace" "this" {
  compartment_id = var.compartment_ocid
}

resource "oci_objectstorage_bucket" "receipts" {
  compartment_id = var.compartment_ocid
  namespace      = data.oci_objectstorage_namespace.this.namespace
  name           = var.bucket_name

  storage_tier = "Standard"

  access_type = "NoPublicAccess"
  versioning  = "Disabled"
}

resource "oci_identity_policy" "objectstorage_lifecycle" {
  compartment_id = var.tenancy_ocid
  name           = "snapsplit-objectstorage-lifecycle"
  description    = "Lets Object Storage apply the receipt retention rule"

  statements = [
    "Allow service objectstorage-${var.region} to manage object-family in compartment id ${var.compartment_ocid}",
  ]
}

resource "oci_objectstorage_object_lifecycle_policy" "receipts" {
  namespace = data.oci_objectstorage_namespace.this.namespace
  bucket    = oci_objectstorage_bucket.receipts.name

  rules {
    name        = "delete-expired-receipts"
    action      = "DELETE"
    target      = "objects"
    is_enabled  = true
    time_amount = var.retention_days
    time_unit   = "DAYS"
  }

  depends_on = [oci_identity_policy.objectstorage_lifecycle]
}

# ---------------------------------------------------------------------------
# The API's own credentials
# ---------------------------------------------------------------------------

# Legacy IAM resources: in a tenancy with identity domains these map onto the
# default domain, which is where a single-tenant project wants them anyway.
resource "oci_identity_group" "api" {
  compartment_id = var.tenancy_ocid
  name           = "snapsplit-api"
  description    = "Read/write on the receipts bucket, nothing else"
}

resource "oci_identity_user" "api" {
  compartment_id = var.tenancy_ocid
  name           = "snapsplit-api"
  description    = "Service user for the SnapSplit API"
  email          = var.api_user_email
}

resource "oci_identity_user_group_membership" "api" {
  group_id = oci_identity_group.api.id
  user_id  = oci_identity_user.api.id
}

# Scoped to this one bucket: leaking the key gets an attacker the receipt
# images and nothing else in the tenancy. `read buckets` is what lets the S3
# layer resolve the bucket at all; `manage objects` covers put/get/delete.
resource "oci_identity_policy" "api" {
  compartment_id = var.tenancy_ocid
  name           = "snapsplit-api-receipts"
  description    = "SnapSplit API access to the receipts bucket"

  statements = [
    "Allow group ${oci_identity_group.api.name} to read buckets in compartment id ${var.compartment_ocid} where target.bucket.name='${oci_objectstorage_bucket.receipts.name}'",
    "Allow group ${oci_identity_group.api.name} to manage objects in compartment id ${var.compartment_ocid} where target.bucket.name='${oci_objectstorage_bucket.receipts.name}'",
  ]
}

# The S3 credential pair. Its secret half is readable exactly once, at create
# time, which is why it has to be an output rather than something you fetch
# later from the console.
resource "oci_identity_customer_secret_key" "api" {
  display_name = "snapsplit-api-s3"
  user_id      = oci_identity_user.api.id
}

# ---------------------------------------------------------------------------
# VM scaffold: deploy files pushed to Object Storage, pulled by the VM
# ---------------------------------------------------------------------------
#
# Terraform Cloud cannot SSH into the VM (the security list only admits
# ssh_allowed_cidr and TFC runners have ephemeral egress IPs), so instead of a
# provisioner we drop the static deploy files into a bucket and hand the VM a
# Pre-Authenticated Request it curls over HTTPS egress — the same pattern
# my-oci-iac uses for its own apps. Secrets (.env) are never uploaded; the S3
# key pair above is read back out with `terraform output`, never placed here.
#
# The VM's public IP is managed by my-oci-iac, so this module takes no
# instance_ocid and never creates a reserved address of its own.

locals {
  deploy_root = "${path.module}/../apps/api/deploy"
  deploy_files = {
    for f in fileset(local.deploy_root, "*") :
    f => f
    if f != ".env"
  }

  # Changes whenever any uploaded deploy file changes, so the PARs and the VM
  # push (below) rotate/re-run and the VM never serves a stale scaffold.
  deploy_hash = sha1(join("|", [
    for f, o in oci_objectstorage_object.deploy :
    "${f}:${o.md5}"
  ]))

  # The script the VM runs: pull every PAR into /opt/apps/snapsplit, make the
  # forced-command deploy script executable, and hand ownership to opc.
  deploy_script = <<-EOT
    sudo mkdir -p /opt/apps/snapsplit
    %{for name, par in oci_objectstorage_preauthrequest.deploy}
    sudo curl -fsSL "${par.full_path}" -o "/opt/apps/snapsplit/${name}"
    %{endfor}
    sudo chmod +x /opt/apps/snapsplit/deploy-on-host.sh
    sudo chown -R opc:opc /opt/apps/snapsplit
  EOT
}

resource "time_static" "par_expiry" {}

resource "oci_objectstorage_bucket" "deploy" {
  compartment_id = var.compartment_ocid
  namespace      = data.oci_objectstorage_namespace.this.namespace
  name           = "snapsplit-deploy"
  access_type    = "NoPublicAccess"
  storage_tier   = "Standard"
}

resource "oci_objectstorage_object" "deploy" {
  for_each  = local.deploy_files
  bucket    = oci_objectstorage_bucket.deploy.name
  namespace = data.oci_objectstorage_namespace.this.namespace
  object    = each.key
  content   = file("${local.deploy_root}/${each.key}")
}

resource "oci_objectstorage_preauthrequest" "deploy" {
  for_each     = local.deploy_files
  bucket       = oci_objectstorage_object.deploy[each.key].bucket
  namespace    = oci_objectstorage_object.deploy[each.key].namespace
  object_name  = oci_objectstorage_object.deploy[each.key].object
  name         = "deploy-${local.deploy_hash}-${sha1(each.key)}-30d"
  access_type  = "ObjectRead"
  time_expires = timeadd(time_static.par_expiry.rfc3339, "720h")
}

# ---------------------------------------------------------------------------
# VM scaffold delivery
# ---------------------------------------------------------------------------
#
# Terraform Cloud cannot SSH into the VM, and the OCI provider (oracle/oci up to
# 8.29.0) does not expose InstanceAgentCommand as a managed resource. So the
# deploy files above are pushed to the existing VM with the OCI CLI Run Command
# (Oracle Cloud Agent "Instance Run Command" plugin), driven from `vm_scaffold.tf`
# via a `null_resource` that runs on the machine applying this config. It curls
# the PARs into /opt/apps/snapsplit. After that, CI pushes only image tags via
# the deploy key. `deploy_pull_commands` stays as a manual fallback for hosts
# without the `oci` CLI.
