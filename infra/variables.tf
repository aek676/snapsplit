variable "tenancy_ocid" {
  description = "OCID of the tenancy. Users, groups and policies are rooted here."
  type        = string
}

variable "compartment_ocid" {
  description = "OCID of the compartment holding the bucket and the IAM resources."
  type        = string
}

variable "region" {
  description = "Region identifier, e.g. eu-madrid-1. Must be the region the VM runs in, so reads from the API never leave it."
  type        = string
}

variable "bucket_name" {
  description = "Bucket for the receipt images. Goes into the API's S3_BUCKET."
  type        = string
  default     = "snapsplit-receipts"
}

variable "retention_days" {
  description = <<-EOT
    Age at which the lifecycle rule deletes a receipt image.

    Sessions expire through the MongoDB TTL index in
    apps/api/src/schemas/session.ts, and TTL deletion happens inside MongoDB
    without telling the API — so the image a session references outlives it
    unless this rule removes it. Keep the two horizons in sync.
  EOT
  type        = number
  default     = 90
}

variable "api_user_email" {
  description = "Email for the API's IAM user. OCI requires one; it is never used to sign in, the user only ever authenticates with the S3 key pair."
  type        = string
}

variable "instance_ocid" {
  description = <<-EOT
    OCID of the VM that should receive the scaffold (the one my-oci-iac owns:
    `terraform output -raw instance_id`). When set, a `null_resource` invokes the
    OCI CLI `compute instance-agent` Run Command to push compose.yaml,
    deploy-on-host.sh and .env.example into /opt/apps/snapsplit automatically — no
    SSH, no manual paste. Leave empty to skip and use the `deploy_pull_commands`
    output instead.

    Requires the `oci` CLI on the machine running `terraform apply` (the deploying
    identity must be able to manage instance-agent-command-family in the compartment)
    and the Oracle Cloud Agent "Instance Run Command" plugin enabled on the VM. The
    plugin runs as `ocarun`; grant it NOPASSWD sudo once (`ocarun ALL=(ALL) NOPASSWD:ALL`)
    so the script can write to /opt/apps.
  EOT
  type        = string
  default     = ""
}
