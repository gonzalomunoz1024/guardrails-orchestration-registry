export interface Dependency {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'infrastructure' | 'identity' | 'compliance' | 'cost' | 'security';
  endpoint: string;
  lastSynced: string;
  data: Record<string, unknown>;
}

export const mockDependencies: Dependency[] = [
  {
    id: 'dep-arch',
    name: 'Architecture Models',
    description: 'Approved infrastructure architectures and configurations',
    icon: 'building',
    category: 'infrastructure',
    endpoint: '/api/v1/dependencies/architecture',
    lastSynced: '2024-03-21T08:00:00Z',
    data: {
      approved_architectures: {
        'web-tier': {
          name: 'Web Application Tier',
          components: [
            { type: 'load_balancer', provider: 'aws', service: 'alb', required: true },
            { type: 'compute', provider: 'aws', service: 'ecs', os: ['linux'], required: true },
            { type: 'database', provider: 'aws', service: 'rds', engines: ['postgresql', 'mysql'], required: true },
            { type: 'cache', provider: 'aws', service: 'elasticache', engines: ['redis'], required: false },
            { type: 'cdn', provider: 'aws', service: 'cloudfront', required: false },
          ],
          networking: {
            vpc_required: true,
            private_subnets: true,
            nat_gateway: true,
          },
        },
        'data-tier': {
          name: 'Data Processing Tier',
          components: [
            { type: 'database', provider: 'aws', service: 'rds', engines: ['postgresql'], required: true },
            { type: 'database', provider: 'mongodb', service: 'atlas', required: true },
            { type: 'compute', provider: 'aws', service: 'ec2', os: ['linux'], required: true },
            { type: 'storage', provider: 'aws', service: 's3', required: true },
          ],
          networking: {
            vpc_required: true,
            private_subnets: true,
            public_access: false,
          },
        },
        'ml-platform': {
          name: 'ML Platform Architecture',
          components: [
            { type: 'compute', provider: 'aws', service: 'sagemaker', required: true },
            { type: 'storage', provider: 'aws', service: 's3', required: true },
            { type: 'database', provider: 'aws', service: 'rds', engines: ['postgresql'], required: true },
            { type: 'compute', provider: 'aws', service: 'ec2', instance_types: ['p3', 'p4', 'g4'], required: false },
          ],
          networking: {
            vpc_required: true,
            private_subnets: true,
          },
        },
      },
      prohibited_services: ['aws:ec2:windows', 'azure:vm:windows-server-2012'],
      required_tags: ['environment', 'owner', 'cost-center', 'project'],
    },
  },
  {
    id: 'dep-users',
    name: 'User Directory',
    description: 'Organization structure, roles, and permissions',
    icon: 'users',
    category: 'identity',
    endpoint: '/api/v1/dependencies/users',
    lastSynced: '2024-03-21T07:30:00Z',
    data: {
      roles: {
        admin: {
          permissions: ['*'],
          max_users: 10,
        },
        developer: {
          permissions: ['read:*', 'write:code', 'deploy:staging'],
          max_users: 500,
        },
        analyst: {
          permissions: ['read:data', 'read:reports', 'export:csv'],
          max_users: 200,
        },
        viewer: {
          permissions: ['read:public'],
          max_users: null,
        },
      },
      departments: ['engineering', 'data-science', 'operations', 'finance', 'legal', 'hr'],
      clearance_levels: {
        public: 0,
        internal: 1,
        confidential: 2,
        restricted: 3,
        top_secret: 4,
      },
      service_accounts: {
        allowed_types: ['ci-cd', 'monitoring', 'backup', 'integration'],
        require_expiry: true,
        max_lifetime_days: 365,
      },
    },
  },
  {
    id: 'dep-compliance',
    name: 'Compliance Standards',
    description: 'Regulatory requirements and compliance frameworks',
    icon: 'shield-check',
    category: 'compliance',
    endpoint: '/api/v1/dependencies/compliance',
    lastSynced: '2024-03-20T12:00:00Z',
    data: {
      frameworks: {
        gdpr: {
          name: 'General Data Protection Regulation',
          regions: ['EU', 'EEA', 'UK'],
          requirements: {
            data_retention_max_days: 730,
            right_to_deletion: true,
            data_portability: true,
            consent_required: true,
            dpo_required_threshold: 250,
          },
        },
        hipaa: {
          name: 'Health Insurance Portability and Accountability Act',
          regions: ['US'],
          requirements: {
            encryption_at_rest: true,
            encryption_in_transit: true,
            audit_logging: true,
            access_controls: true,
            phi_handling: 'restricted',
          },
        },
        soc2: {
          name: 'SOC 2 Type II',
          requirements: {
            access_reviews_frequency_days: 90,
            vulnerability_scanning: true,
            penetration_testing_frequency_days: 365,
            incident_response_plan: true,
            business_continuity_plan: true,
          },
        },
        pci_dss: {
          name: 'Payment Card Industry Data Security Standard',
          requirements: {
            cardholder_data_encryption: true,
            network_segmentation: true,
            quarterly_scans: true,
            password_complexity: true,
            mfa_required: true,
          },
        },
      },
      data_classifications: ['public', 'internal', 'confidential', 'pii', 'phi', 'pci'],
    },
  },
  {
    id: 'dep-budgets',
    name: 'Cost Thresholds',
    description: 'Budget limits and spending controls by department',
    icon: 'dollar-sign',
    category: 'cost',
    endpoint: '/api/v1/dependencies/budgets',
    lastSynced: '2024-03-21T06:00:00Z',
    data: {
      departments: {
        engineering: {
          monthly_budget: 150000,
          current_spend: 98500,
          alert_threshold: 0.8,
          approval_required_above: 10000,
          approvers: ['cto', 'vp-engineering'],
        },
        'data-science': {
          monthly_budget: 80000,
          current_spend: 45200,
          alert_threshold: 0.75,
          approval_required_above: 5000,
          approvers: ['head-of-data', 'cto'],
        },
        operations: {
          monthly_budget: 50000,
          current_spend: 32100,
          alert_threshold: 0.8,
          approval_required_above: 5000,
          approvers: ['vp-ops', 'cfo'],
        },
        marketing: {
          monthly_budget: 30000,
          current_spend: 28500,
          alert_threshold: 0.9,
          approval_required_above: 2500,
          approvers: ['cmo', 'cfo'],
        },
      },
      global_limits: {
        single_transaction_max: 50000,
        daily_spend_max: 100000,
        requires_cfo_above: 25000,
      },
      cost_centers: ['cloud-infra', 'saas-tools', 'contractors', 'hardware', 'training'],
    },
  },
  {
    id: 'dep-security',
    name: 'Security Policies',
    description: 'Security controls, approved software, and network rules',
    icon: 'lock',
    category: 'security',
    endpoint: '/api/v1/dependencies/security',
    lastSynced: '2024-03-21T08:15:00Z',
    data: {
      approved_software: {
        languages: ['python:>=3.9', 'node:>=18', 'go:>=1.20', 'java:>=17', 'rust:>=1.70'],
        frameworks: ['react', 'vue', 'django', 'fastapi', 'spring-boot', 'gin'],
        databases: ['postgresql:>=14', 'mysql:>=8', 'mongodb:>=6', 'redis:>=7'],
        ci_cd: ['github-actions', 'gitlab-ci', 'jenkins:>=2.400'],
      },
      vulnerability_thresholds: {
        critical: 0,
        high: 0,
        medium: 10,
        low: 50,
        block_deploy_on: ['critical', 'high'],
      },
      network_rules: {
        allowed_ingress_ports: [80, 443, 22],
        allowed_egress: ['*.amazonaws.com', '*.github.com', '*.npmjs.org', '*.pypi.org'],
        blocked_countries: ['KP', 'IR', 'SY', 'CU'],
        require_waf: true,
        require_ddos_protection: true,
      },
      secrets_management: {
        providers: ['aws-secrets-manager', 'hashicorp-vault', 'azure-keyvault'],
        rotation_required: true,
        max_age_days: 90,
        prohibited_in_code: true,
      },
      authentication: {
        mfa_required: true,
        session_timeout_minutes: 480,
        password_min_length: 14,
        password_complexity: true,
        sso_providers: ['okta', 'azure-ad', 'google-workspace'],
      },
    },
  },
  {
    id: 'dep-services',
    name: 'Service Catalog',
    description: 'Approved cloud services and their configurations',
    icon: 'cloud',
    category: 'infrastructure',
    endpoint: '/api/v1/dependencies/services',
    lastSynced: '2024-03-21T07:45:00Z',
    data: {
      aws: {
        compute: ['ec2', 'ecs', 'eks', 'lambda', 'fargate'],
        storage: ['s3', 'ebs', 'efs'],
        database: ['rds', 'dynamodb', 'elasticache', 'documentdb'],
        networking: ['vpc', 'alb', 'nlb', 'cloudfront', 'route53'],
        security: ['iam', 'kms', 'secrets-manager', 'waf', 'shield'],
        prohibited: ['ec2:t2.micro', 'rds:db.t2.*'],
      },
      gcp: {
        compute: ['gce', 'gke', 'cloud-run', 'cloud-functions'],
        storage: ['gcs', 'persistent-disk'],
        database: ['cloud-sql', 'firestore', 'bigtable', 'memorystore'],
        prohibited: ['n1-standard-1'],
      },
      azure: {
        compute: ['virtual-machines', 'aks', 'functions', 'container-instances'],
        storage: ['blob-storage', 'files', 'disk'],
        database: ['sql-database', 'cosmos-db', 'cache-for-redis'],
        prohibited: ['basic-tier'],
      },
      required_configurations: {
        encryption: true,
        logging: true,
        tagging: ['environment', 'owner', 'cost-center'],
        backup: {
          enabled: true,
          retention_days: 30,
        },
      },
    },
  },
];

export function getDependencyIcon(iconName: string): string {
  const icons: Record<string, string> = {
    building: 'Building2',
    users: 'Users',
    'shield-check': 'ShieldCheck',
    'dollar-sign': 'DollarSign',
    lock: 'Lock',
    cloud: 'Cloud',
  };
  return icons[iconName] || 'Box';
}
