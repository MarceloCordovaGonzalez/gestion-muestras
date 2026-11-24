terraform {
  required_version = ">= 1.6"
  backend "gcs" {
    prefix = "gestion-muestras/dev"
    # bucket se indica en: terraform init -backend-config="bucket=<bucket-de-estado>"
  }
}

variable "proyecto" { type = string }
variable "red_vpc" { type = string }

provider "google" {
  project = var.proyecto
  region  = "southamerica-west1"
}

# Desarrollo: escala a cero, Cloud SQL mínimo, datos sintéticos (Modelo 10.2).
module "plataforma" {
  source                  = "../../modulos/plataforma"
  proyecto                = var.proyecto
  ambiente                = "dev"
  red_vpc                 = var.red_vpc
  sql_tier                = "db-f1-micro"
  sql_alta_disponibilidad = false
  api_min_instancias      = 0
  api_max_instancias      = 2
  crear_registro          = true
  origenes_web            = ["http://localhost:5173"]
}

output "url_api" { value = module.plataforma.url_api }
