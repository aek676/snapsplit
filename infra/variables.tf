variable "tenancy_ocid" {
  description = "OCID of the tenancy. Users, groups and policies are rooted here."
  type        = string
}

variable "compartment_ocid" {
  description = "OCID of the compartment holding the bucket and the reserved IP."
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
  description = "OCID of the VM running the API. Set it to convert its public IP into a reserved one; leave null to skip that (the ephemeral IP then changes on every stop/start)."
  type        = string
  default     = null
}
