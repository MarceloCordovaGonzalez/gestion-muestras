terraform {
  required_version = ">= 1.6"
  backend "gcs" {
    prefix = "gestion-muestras/qa"
  }
}

variable "proyecto" { type = string }
variable "red_vpc" { type = string }
variable "origenes_web" { type = list(string) }

provider "google" {
  project = var.proyecto
  region  = "southamerica-west1"
}

# Calidad (QA/UAT): igual a producción en menor tamaño; datos de la planilla y casos de prueba.
module "plataforma" {
  source                  = "../../modulos/plataforma"
  proyecto                = var.proyecto
  ambiente                = "qa"
  red_vpc                 = var.red_vpc
  sql_tier                = "db-custom-1-3840"
  sql_alta_disponibilidad = false
  api_min_instancias      = 0
  api_max_instancias      = 2
  origenes_web            = var.origenes_web
}

output "url_api" { value = module.plataforma.url_api }
