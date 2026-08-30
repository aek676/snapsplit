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

resource "oci_identity_policy" "api" {
  compartment_id = var.tenancy_ocid
  name           = "snapsplit-api-receipts"
  description    = "SnapSplit API access to the receipts bucket"

  statements = [
    "Allow group ${oci_identity_group.api.name} to read buckets in compartment id ${var.compartment_ocid} where target.bucket.name='${oci_objectstorage_bucket.receipts.name}'",
    "Allow group ${oci_identity_group.api.name} to manage objects in compartment id ${var.compartment_ocid} where target.bucket.name='${oci_objectstorage_bucket.receipts.name}'",
  ]
}

resource "oci_identity_customer_secret_key" "api" {
  display_name = "snapsplit-api-s3"
  user_id      = oci_identity_user.api.id
}
