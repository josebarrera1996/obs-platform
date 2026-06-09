# ── Terraform Variables ──

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "obs-platform"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "container_image" {
  description = "Docker image repository"
  type        = string
  default     = "obs-platform/app"
}

variable "container_tag" {
  description = "Docker image tag"
  type        = string
  default     = "latest"
}

variable "vpc_id" {
  description = "VPC ID for the ECS service"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for the ECS service"
  type        = list(string)
}

variable "certificate_arn" {
  description = "ARN of the ACM certificate for HTTPS"
  type        = string
}

variable "app_cpu" {
  description = "CPU units for the Fargate task (256, 512, 1024, 2048, 4096)"
  type        = number
  default     = 1024
}

variable "app_memory" {
  description = "Memory for the Fargate task (512, 1024, 2048, 4096, 8192)"
  type        = number
  default     = 2048
}

variable "app_count" {
  description = "Number of ECS task instances"
  type        = number
  default     = 2
}

variable "encryption_key" {
  description = "AES-256 encryption key (64 hex chars)"
  type        = string
  sensitive   = true
}

variable "auth_secret" {
  description = "NextAuth secret for JWT signing"
  type        = string
  sensitive   = true
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for alerts"
  type        = string
  default     = ""
  sensitive   = true
}