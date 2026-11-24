# Plataforma de Gestión de Muestras en Google Cloud (Modelo de Arquitectura 10).
terraform {
  required_version = ">= 1.6"
  required_providers {
    google = { source = "hashicorp/google", version = "~> 6.12" }
  }
}

locals {
  prefijo = "gm-${var.ambiente}"
  etiquetas = {
    sistema  = "gestion-muestras"
    ambiente = var.ambiente
  }
}

# ---------------------------------------------------------------- Artefactos
resource "google_artifact_registry_repository" "gm" {
  count         = var.crear_registro ? 1 : 0
  project       = var.proyecto
  location      = var.region
  repository_id = "gm"
  format        = "DOCKER"
  labels        = local.etiquetas
}

# ---------------------------------------------------------------- Base de datos
resource "google_sql_database_instance" "pg" {
  project             = var.proyecto
  name                = "${local.prefijo}-pg"
  region              = var.region
  database_version    = "POSTGRES_16"
  deletion_protection = var.ambiente == "prod"

  settings {
    tier              = var.sql_tier
    availability_type = var.sql_alta_disponibilidad ? "REGIONAL" : "ZONAL"
    disk_autoresize   = true
    user_labels       = local.etiquetas

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true # PITR 7 días (Modelo 8.5)
      transaction_log_retention_days = 7
      backup_retention_settings { retained_backups = 30 }
    }
    ip_configuration {
      ipv4_enabled    = false
      private_network = var.red_vpc
      ssl_mode        = "ENCRYPTED_ONLY"
    }
    database_flags {
      name  = "cloudsql.iam_authentication"
      value = "on"
    }
    insights_config { query_insights_enabled = true }
  }
}

resource "google_sql_database" "gm" {
  project  = var.proyecto
  instance = google_sql_database_instance.pg.name
  name     = "gestion_muestras"
}

# ---------------------------------------------------------------- Identidad de servicio
resource "google_service_account" "api" {
  project      = var.proyecto
  account_id   = "${local.prefijo}-api"
  display_name = "API Gestión de Muestras (${var.ambiente})"
}

resource "google_project_iam_member" "api_roles" {
  for_each = toset(["roles/cloudsql.client", "roles/cloudsql.instanceUser", "roles/secretmanager.secretAccessor",
  "roles/logging.logWriter", "roles/monitoring.metricWriter", "roles/firebaseauth.admin"])
  project = var.proyecto
  role    = each.value
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_secret_manager_secret" "database_url" {
  project   = var.proyecto
  secret_id = "${local.prefijo}-database-url"
  replication {
    user_managed {
      replicas { location = var.region } # residencia de datos en Chile
    }
  }
  labels = local.etiquetas
}

# ---------------------------------------------------------------- API (Cloud Run)
resource "google_cloud_run_v2_service" "api" {
  project  = var.proyecto
  name     = "gm-api"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"
  labels   = local.etiquetas

  template {
    service_account = google_service_account.api.email
    scaling {
      min_instance_count = var.api_min_instancias # ≥ 1 en prod: sin arranque en frío
      max_instance_count = var.api_max_instancias
    }
    vpc_access {
      network_interfaces { network = var.red_vpc }
      egress = "PRIVATE_RANGES_ONLY"
    }
    containers {
      image = var.imagen_api
      ports { container_port = 8080 }
      resources { limits = { cpu = "1", memory = "512Mi" } }
      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "FIREBASE_PROJECT_ID"
        value = var.proyecto
      }
      env {
        name  = "CORS_ORIGINS"
        value = join(",", var.origenes_web)
      }
      env {
        name  = "FEATURE_PENDIENTES_ENTREGA"
        value = "false" # MEJ-18 desactivada en MVP1
      }
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }
      startup_probe {
        http_get { path = "/v1/salud" }
      }
    }
  }
  lifecycle {
    ignore_changes = [template[0].containers[0].image, traffic, client, client_version] # los gestiona CI/CD
  }
}

resource "google_cloud_run_v2_service_iam_member" "publico" {
  project  = var.proyecto
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers" # la autenticación es por JWT en la API; WAF con Cloud Armor en prod
}

# ---------------------------------------------------------------- Procesos programados
resource "google_cloud_run_v2_job" "trabajos" {
  for_each = {
    "gm-planificacion" = ["dist/jobs/planificacion-diaria.js"]
    "gm-migraciones"   = ["node_modules/prisma/build/index.js", "migrate", "deploy"]
  }
  project  = var.proyecto
  name     = each.key
  location = var.region
  labels   = local.etiquetas
  template {
    template {
      service_account = google_service_account.api.email
      max_retries     = 1
      vpc_access {
        network_interfaces { network = var.red_vpc }
      }
      containers {
        image   = var.imagen_api
        command = ["node"]
        args    = each.value
        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.database_url.secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }
  lifecycle { ignore_changes = [template[0].template[0].containers[0].image] }
}

resource "google_cloud_scheduler_job" "planificacion" {
  project   = var.proyecto
  region    = var.region
  name      = "${local.prefijo}-planificacion-diaria"
  schedule  = "5 0 * * *" # 00:05 (RN-14)
  time_zone = "America/Santiago"
  http_target {
    http_method = "POST"
    uri         = "https://run.googleapis.com/v2/projects/${var.proyecto}/locations/${var.region}/jobs/gm-planificacion:run"
    oauth_token { service_account_email = google_service_account.api.email }
  }
}

# ---------------------------------------------------------------- Web y archivos
resource "google_storage_bucket" "web" {
  project                     = var.proyecto
  name                        = "${var.proyecto}-${local.prefijo}-web"
  location                    = var.region
  uniform_bucket_level_access = true
  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html"
  }
  labels = local.etiquetas
}

resource "google_storage_bucket" "archivos" {
  project                     = var.proyecto
  name                        = "${var.proyecto}-${local.prefijo}-archivos"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  lifecycle_rule {
    condition { age = 90 } # planillas y exportaciones: 90 días (Modelo 8.5)
    action { type = "Delete" }
  }
  labels = local.etiquetas
}
