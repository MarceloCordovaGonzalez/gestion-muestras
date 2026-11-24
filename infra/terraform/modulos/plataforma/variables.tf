variable "proyecto" {
  type        = string
  description = "ID del proyecto de Google Cloud del ambiente"
}

variable "ambiente" {
  type = string
  validation {
    condition     = contains(["dev", "qa", "prod"], var.ambiente)
    error_message = "ambiente debe ser dev, qa o prod."
  }
}

variable "region" {
  type    = string
  default = "southamerica-west1" # Santiago de Chile (ADR-08)
}

variable "red_vpc" {
  type        = string
  description = "Red VPC (self_link) para la IP privada de Cloud SQL"
}

variable "imagen_api" {
  type        = string
  description = "Imagen inicial; las versiones siguientes las despliega CI/CD"
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "sql_tier" {
  type    = string
  default = "db-custom-1-3840"
}

variable "sql_alta_disponibilidad" {
  type    = bool
  default = false
}

variable "api_min_instancias" {
  type    = number
  default = 0
}

variable "api_max_instancias" {
  type    = number
  default = 4
}

variable "origenes_web" {
  type    = list(string)
  default = []
}

variable "crear_registro" {
  type        = bool
  default     = false
  description = "Crear el Artifact Registry (solo en el proyecto que aloja las imágenes)"
}
