output "url_api" {
  value = google_cloud_run_v2_service.api.uri
}

output "bucket_web" {
  value = google_storage_bucket.web.name
}

output "instancia_sql" {
  value = google_sql_database_instance.pg.connection_name
}

output "cuenta_servicio_api" {
  value = google_service_account.api.email
}
