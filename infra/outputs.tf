# These five are the S3_* block of the VM's .env, verbatim.

output "s3_endpoint" {
  description = "S3-compatible endpoint for the tenancy's Object Storage."
  value       = "https://${data.oci_objectstorage_namespace.this.namespace}.compat.objectstorage.${var.region}.oraclecloud.com"
}

output "s3_region" {
  value = var.region
}

output "s3_bucket" {
  value = oci_objectstorage_bucket.receipts.name
}

output "s3_access_key_id" {
  value = oci_identity_customer_secret_key.api.id
}

output "s3_secret_access_key" {
  description = "Read it with `terraform output -raw s3_secret_access_key`."
  value       = oci_identity_customer_secret_key.api.key
  sensitive   = true
}

output "public_ip" {
  description = "The reserved address, when instance_ocid is set. Point the DuckDNS record at it."
  value       = one(oci_core_public_ip.api[*].ip_address)
}
