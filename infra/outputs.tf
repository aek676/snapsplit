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

# Paste on the VM once to download the deploy files into /opt/apps/snapsplit.
# Terraform Cloud cannot SSH in, so the VM pulls them over HTTPS egress.
output "deploy_pull_commands" {
  description = "Run on the VM once to fetch compose.yaml, deploy-on-host.sh and .env.example into /opt/apps/snapsplit."
  value       = <<-EOT
    sudo mkdir -p /opt/apps/snapsplit
    %{for name, par in oci_objectstorage_preauthrequest.deploy}
    sudo curl -fsSL "${par.full_path}" -o "/opt/apps/snapsplit/${name}"
    %{endfor}
    sudo chmod +x /opt/apps/snapsplit/deploy-on-host.sh
    sudo chown -R opc:opc /opt/apps/snapsplit
  EOT
}
