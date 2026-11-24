terraform {
  required_version = ">= 1.6"
  backend "gcs" {
    prefix = "gestion-muestras/prod"
  }
}

variable "proyecto" { type = string }
variable "red_vpc" { type = string }
variable "origenes_web" { type = list(string) }

provider "google" {
  project = var.proyecto
  region  = "southamerica-west1"
}

# Producción: Cloud SQL en alta disponibilidad regional, ≥ 1 instancia activa (RNF-02, Modelo 10.2).
module "plataforma" {
  source                  = "../../modulos/plataforma"
  proyecto                = var.proyecto
  ambiente                = "prod"
  red_vpc                 = var.red_vpc
  sql_tier                = "db-custom-2-7680"
  sql_alta_disponibilidad = true
  api_min_instancias      = 1
  api_max_instancias      = 10
  origenes_web            = var.origenes_web
}

output "url_api" { value = module.plataforma.url_api }
