data "oci_objectstorage_namespace" "this" {
  compartment_id = var.compartment_ocid
}

# ---------------------------------------------------------------------------
# Receipt images
# ---------------------------------------------------------------------------

resource "oci_objectstorage_bucket" "receipts" {
  compartment_id = var.compartment_ocid
  namespace      = data.oci_objectstorage_namespace.this.namespace
  name           = var.bucket_name

  # Standard, not InfrequentAccess: a receipt is read right after it is
  # uploaded, and IA bills a retrieval fee for exactly that access pattern.
  storage_tier = "Standard"

  # The API proxies every image through itself (apps/api/src/modules/receipt),
  # so nothing needs to reach the bucket anonymously.
  access_type = "NoPublicAccess"
  versioning  = "Disabled"
}

# Object Storage applies lifecycle rules as a service principal, and refuses to
# accept the policy below until that principal is allowed to act on the bucket.
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
# Reserved public IP (optional)
# ---------------------------------------------------------------------------
#
# An ephemeral IP is released whenever the instance stops, which would leave
# the DuckDNS record pointing nowhere. Reserving it is free on Always Free.
#
# One manual step first: detach the current ephemeral IP in the console (the
# instance's VNIC → Edit → No public IP). Oracle will not convert one in place,
# and the address you end up with is a different one.

data "oci_core_vnic_attachments" "api" {
  count          = var.instance_ocid == null ? 0 : 1
  compartment_id = var.compartment_ocid
  instance_id    = var.instance_ocid
}

data "oci_core_private_ips" "api" {
  count   = var.instance_ocid == null ? 0 : 1
  vnic_id = data.oci_core_vnic_attachments.api[0].vnic_attachments[0].vnic_id
}

resource "oci_core_public_ip" "api" {
  count          = var.instance_ocid == null ? 0 : 1
  compartment_id = var.compartment_ocid
  display_name   = "snapsplit-api"
  lifetime       = "RESERVED"
  private_ip_id  = data.oci_core_private_ips.api[0].private_ips[0].id
}
