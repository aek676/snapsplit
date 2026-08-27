terraform {
  required_version = ">= 1.9"

  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 8.0"
    }
  }
}

# Credentials come from ~/.oci/config (run `oci setup config` once), so nothing
# secret lives in this directory. Terraform is meant to be run from a laptop:
# CI never touches the tenancy.
provider "oci" {
  region = var.region
}
