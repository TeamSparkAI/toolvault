'use client';

import Link from 'next/link';

interface Concept {
  title: string;
  description: string;
  path: string;
  icon: React.ReactNode;
  details: string[];
}

interface QuickStartStep {
  number: number;
  title: string;
  description: string;
  path: string;
  linkText: string;
  isComplete?: boolean;
}

const quickStartSteps: QuickStartStep[] = [
  {
    number: 1,
    title: 'Discover & Import Clients',
    description: 'Use the Client Discovery page to discover and import new clients that connect to your system, converting their servers to be managed by ToolVault.',
    path: '/clients/discover',
    linkText: 'Go to Client Discovery'
  },
  {
    number: 2,
    title: 'Review Imported Clients',
    description: 'Review imported clients, including their configurations and the servers they are connected to.',
    path: '/clients',
    linkText: 'Review Clients'
  },
  {
    number: 3,
    title: 'Validate Managed Servers',
    description: 'Review your managed servers. Configure settings, validate connections, and test tools.',
    path: '/servers',
    linkText: 'Validate Servers'
  },
  {
    number: 4,
    title: 'Test Your Agents',
    description: 'Ensure your agents work correctly by testing them. Review messages they generate in ToolVault to confirm they are using managed servers.',
    path: '/messages',
    linkText: 'Review Messages'
  },
  {
    number: 5,
    title: 'Review and Tune Security Policies',
    description: 'Review your security policies, then tune them to your needs.',
    path: '/policies',
    linkText: 'Review Policies'
  },
  {
    number: 5,
    title: 'Monitor & Maintain',
    description: 'Use the dashboard to monitor your system for unhandled alerts and compliance issues, as well as to review message traffic and alerts.',
    path: '/dashboard',
    linkText: 'View Dashboard',
    isComplete: true
  }
];

const concepts: Concept[] = [
  {
    title: 'Dashboard',
    description: 'Overview of your system status and key metrics',
    path: '/dashboard',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    details: [
      'View system health and performance metrics',
      'Monitor active alerts and compliance issues',
      'See recent activity and system status',
      'Quick access to key functions'
    ]
  },
  {
    title: 'Server Catalog',
    description: 'Browse and discover available MCP servers',
    path: '/catalog',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    details: [
      'Discover available MCP servers',
      'View server descriptions and capabilities',
      'Add servers to your managed list',
      'Browse by category or search'
    ]
  },
  {
    title: 'Server Registry',
    description: 'Browse servers from the official MCP Registry',
    path: '/registry',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    details: [
      'Access the official MCP Registry',
      'Browse verified and official servers',
      'View detailed server configurations',
      'Install servers with proper package management'
    ]
  },
  {
    title: 'Servers',
    description: 'Manage your MCP servers and their configurations',
    path: '/servers',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
      </svg>
    ),
    details: [
      'View all your managed MCP servers',
      'Configure server settings and parameters',
      'Monitor server status and test tools',
      'Manage server connections and clients'
    ]
  },
  {
    title: 'Clients',
    description: 'Manage client connections and their access to servers',
    path: '/clients',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    details: [
      'View all connected clients',
      'Configure client-specific settings',
      'Monitor and manager servers used by each client',
      'Review message and alerts for a client'
    ]
  },
  {
    title: 'Policies',
    description: 'Define rules and policies for server behavior and security',
    path: '/policies',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    details: [
      'Review current policies and their status',
      'Create security policies',
      'Inspect securuty policy details',
      'Review alerts generated by a policy'
    ]
  },
  {
    title: 'Compliance',
    description: 'Review and manage compliance with policies and regulations',
    path: '/compliance',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2h-2M8 4a2 2 0 002 2h2a2 2 0 002-2M8 4a2 2 0 012-2h2a2 2 0 012 2M8 9h6M8 12h6M8 15h6" />
      </svg>
    ),
    details: [
      'Review compliance guidelines and policies',
      'Monitor compliance issues',
      'Review and address system compliance issues',
      'Review and address client compliance issues'
    ]
  },
  {
    title: 'Alerts',
    description: 'Monitor and respond to system alerts and notifications',
    path: '/alerts',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
    details: [
      'View active alerts and notifications',
      'Acknowledge and resolve alerts',
      'Search and filter alerts',
      'Track alert history and trends'
    ]
  },
  {
    title: 'Messages',
    description: 'Review and analyze message traffic between clients and servers',
    path: '/messages',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
    details: [
      'View message traffic and logs',
      'Analyze communication patterns',
      'Search and filter messages',
      'Monitor for suspicious activity'
    ]
  }
];

export default function HelpPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Quick Start */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Quick Start Guide</h2>
        <p className="text-gray-600 mb-6">
          Get started with ToolVault by discovering and importing clients, converting their servers to be managed by ToolVault, and validating your setup.  It's quicker and easier than it sounds!
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quickStartSteps.map((step, index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                step.isComplete ? 'bg-green-100' : 'bg-blue-100'
              }`}>
                {step.isComplete ? (
                  <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className={`text-sm font-medium ${step.isComplete ? 'text-green-600' : 'text-blue-600'}`}>
                    {step.number}
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-600 mb-2">
                  {step.description}
                </p>
                <Link
                  href={step.path}
                  className="inline-flex items-center mt-2 text-sm text-blue-600 hover:text-blue-800"
                >
                  {step.linkText}
                  <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Help & Documentation */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Key Concepts and Features</h2>
        <p className="text-lg text-gray-600">
          Learn about the key concepts and features of ToolVault. Each section below explains a major component 
          and provides a direct link to access it.
        </p>
      </div>

      {/* Concepts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {concepts.map((concept, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 text-blue-600">
                {concept.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-semibold text-gray-900">{concept.title}</h2>
                  <Link
                    href={concept.path}
                    className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors"
                  >
                    Go to {concept.title}
                    <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
                <p className="text-gray-600 mb-4">{concept.description}</p>
                <ul className="space-y-2">
                  {concept.details.map((detail, detailIndex) => (
                    <li key={detailIndex} className="flex items-start">
                      <svg className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-gray-600">{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Support & Resources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact Support */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Contact Us</h2>
          <p className="text-gray-600 mb-4">
            Need help with ToolVault? Our team is here to assist you.
          </p>
          <div className="flex space-x-3">
            <a
              href="mailto:support@teamspark.ai"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Contact Support
            </a>
            <a
              href="mailto:sales@teamspark.ai"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Sales Inquiries
            </a>
          </div>
        </div>

        {/* Resources */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Resources</h2>
          <ul className="space-y-3">
            <li>
              <a
                href="https://github.com/TeamSparkAI/toolvault/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 flex items-center"
              >
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Request Features or Report Bugs
              </a>
            </li>
            <li>
              <a
                href="https://github.com/TeamSparkAI/toolvault"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 flex items-center"
              >
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                GitHub Repository
              </a>
            </li>
            <li>
              <a
                href="https://teamspark.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 flex items-center"
              >
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                </svg>
                TeamSpark Website
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
} 