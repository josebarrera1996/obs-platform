# ── Terraform Outputs ──

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = aws_ecs_service.app.name
}

output "load_balancer_dns" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.app.dns_name
}

output "load_balancer_arn" {
  description = "ARN of the Application Load Balancer"
  value       = aws_lb.app.arn
}

output "app_url" {
  description = "Production URL of the application"
  value       = "https://${aws_lb.app.dns_name}"
}

output "cloudwatch_log_group" {
  description = "CloudWatch Log Group name for the app"
  value       = aws_cloudwatch_log_group.app.name
}

output "security_group_app" {
  description = "Security Group ID for the app tasks"
  value       = aws_security_group.app.id
}

output "security_group_alb" {
  description = "Security Group ID for the ALB"
  value       = aws_security_group.alb.id
}