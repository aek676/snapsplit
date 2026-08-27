# The state holds the API's secret key in clear, so it never goes near git.
# It lives in an Object Storage bucket reached through the S3 API; the settings
# are in backend.hcl (gitignored, see backend.hcl.example):
#
#   terraform init -backend-config=backend.hcl
#
# That bucket and the Customer Secret Key signing for it are the one piece of
# bootstrap you create by hand — Terraform cannot host its own state.
terraform {
  backend "s3" {}
}
