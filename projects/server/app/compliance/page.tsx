'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getClientIcon } from '@/lib/client-icons';
import { useCompliance } from '../contexts/ComplianceContext';

export default function CompliancePage() {
  const { complianceData, isLoading: loading, error, refreshCompliance } = useCompliance();
  const [guidelinesExpanded, setGuidelinesExpanded] = useState(false);

  // Trigger a reload when the page is accessed to ensure data is current
  useEffect(() => {
    refreshCompliance();
  }, [refreshCompliance]);

  const getStatusIcon = (status: 'compliant' | 'warning' | 'error') => {
    switch (status) {
      case 'compliant':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getStatusColor = (status: 'compliant' | 'warning' | 'error') => {
    switch (status) {
      case 'compliant':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading compliance data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-800">Error: {error}</div>
      </div>
    );
  }

  if (!complianceData) {
    return (
      <div className="text-gray-500">No compliance data available</div>
    );
  }

  const { systemCompliance, clientCompliance } = complianceData;
  const compliantClients = clientCompliance.filter(c => c.status === 'compliant').length;
  const totalClients = clientCompliance.length;

  return (
    <div className="space-y-6">
      {/* Compliance Guidelines Section */}
      <div className="bg-white rounded-lg shadow">
        <button
          onClick={() => setGuidelinesExpanded(!guidelinesExpanded)}
          className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900">Compliance Guidelines</h2>
          </div>
          <svg 
            className={`w-5 h-5 text-gray-500 transition-transform ${guidelinesExpanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {guidelinesExpanded && (
          <div className="px-6 pb-6 border-t border-gray-200">
            <div className="mt-4 space-y-6">
              {/* System Compliance Guidelines */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">System Compliance Requirements</h3>
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">Client Token Required</h4>
                    <p className="text-sm text-blue-800 mb-2">
                      <strong>Requirement:</strong> Only registered clients should have access to managed servers.
                    </p>
                    <p className="text-sm text-blue-700">
                      <strong>Impact:</strong> When disabled, unregistered clients can access managed servers, creating security vulnerabilities.
                    </p>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">Strict Server Access</h4>
                    <p className="text-sm text-blue-800 mb-2">
                      <strong>Requirement:</strong> Clients should only access servers explicitly assigned to them.
                    </p>
                    <p className="text-sm text-blue-700">
                      <strong>Impact:</strong> When disabled, clients can access servers not assigned to them, potentially exposing sensitive resources.
                    </p>
                  </div>
                </div>
              </div>

              {/* Client Compliance Guidelines */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Client Compliance Requirements</h3>
                <div className="space-y-3">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-medium text-red-900 mb-2">Managed Client Configuration</h4>
                    <p className="text-sm text-red-800 mb-2">
                      <strong>Requirement:</strong> All clients should have a configuration path set (be linked/managed clients) and should have been scanned at least once.
                    </p>
                    <p className="text-sm text-red-700">
                      <strong>Impact:</strong> Unlinked clients cannot be properly managed or monitored. Clients that have never been scanned have unknown configurations.
                    </p>
                  </div>
                  
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-medium text-red-900 mb-2">Server Security</h4>
                    <p className="text-sm text-red-800 mb-2">
                      <strong>Requirement:</strong> Clients should not have access to unmanaged or non-secure servers.
                    </p>
                    <p className="text-sm text-red-700">
                      <strong>Impact:</strong> Access to unmanaged or non-secure servers presents security risks including exposure of sensitive data.
                    </p>
                  </div>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-900 mb-2">Regular Scanning</h4>
                    <p className="text-sm text-yellow-800 mb-2">
                      <strong>Requirement:</strong> Clients should be scanned within the last 30 days to detect changes and updates.
                    </p>
                    <p className="text-sm text-yellow-700">
                      <strong>Impact:</strong> Clients that have not been scanned recently may have outdated configurations, and may have undetected security and compliance issues.
                    </p>
                  </div>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-900 mb-2">Pending Operations</h4>
                    <p className="text-sm text-yellow-800 mb-2">
                      <strong>Requirement:</strong> All sync operations should be completed promptly.
                    </p>
                    <p className="text-sm text-yellow-700">
                      <strong>Impact:</strong> Pending operations indicate incomplete synchronization, which can lead to configuration drift. Push them promptly. Alternatively, set clients to auto update.
                    </p>
                  </div>
                </div>
              </div>

              {/* Compliance Status Levels */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Compliance Status Levels</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <h4 className="font-medium text-green-900">Compliant</h4>
                    </div>
                    <p className="text-sm text-green-700">
                      All requirements are met. No action needed.
                    </p>
                  </div>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <h4 className="font-medium text-yellow-900">Warning</h4>
                    </div>
                    <p className="text-sm text-yellow-700">
                      Minor issues detected. Review and address when possible.
                    </p>
                  </div>
                  
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h4 className="font-medium text-red-900">Error</h4>
                    </div>
                    <p className="text-sm text-red-700">
                      Critical issues detected. Immediate action required.
                    </p>
                  </div>
                </div>
              </div>

              {/* Best Practices */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Best Practices</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-medium">•</span>
                      <span>Enable both system compliance settings for maximum security</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-medium">•</span>
                      <span>Ensure all clients have configuration paths set</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-medium">•</span>
                      <span>Perform client scans periodically to maintain compliance</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-medium">•</span>
                      <span>Set clients to auto update, or monitor and resolve pending operations promptly for manual update clients</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-medium">•</span>
                      <span>Review server assignments and security settings regularly</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-medium">•</span>
                      <span>Address compliance issues in order of severity</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* System Compliance Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">System Compliance</h2>
          <div className="text-sm text-gray-500">
            {(() => {
              const nonCompliantCount = [systemCompliance.requireClientToken, systemCompliance.strictServerAccess]
                .filter(setting => !setting).length;
              return nonCompliantCount === 0 ? 'No system issues' : `${nonCompliantCount} system issue${nonCompliantCount === 1 ? '' : 's'}`;
            })()}
          </div>
        </div>
        <div className="space-y-4">
          {/* Client Token Required */}
          <div className={`border rounded-lg p-4 ${
            systemCompliance.requireClientToken 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-start">
              <div className="flex-shrink-0 mr-3 mt-1">
                {systemCompliance.requireClientToken ? (
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-medium text-gray-900">Client Token Required</h3>
                  <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                    systemCompliance.requireClientToken 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {systemCompliance.requireClientToken ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  {systemCompliance.requireClientToken 
                    ? 'Only registered clients may access managed servers'
                    : 'Unregistered clients have access to managed servers'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Strict Server Access */}
          <div className={`border rounded-lg p-4 ${
            systemCompliance.strictServerAccess 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-start">
              <div className="flex-shrink-0 mr-3 mt-1">
                {systemCompliance.strictServerAccess ? (
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-medium text-gray-900">Strict Server Access</h3>
                  <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                    systemCompliance.strictServerAccess 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {systemCompliance.strictServerAccess ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  {systemCompliance.strictServerAccess
                    ? 'Clients can only access servers assigned to them'
                    : 'Clients can access servers not assigned to them'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Client Compliance Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Client Compliance</h2>
          <div className="text-sm text-gray-500">
            {(() => {
              const nonCompliantCount = clientCompliance.filter(c => c.status !== 'compliant').length;
              return nonCompliantCount === 0 ? 'No client issues' : `${nonCompliantCount} client issue${nonCompliantCount === 1 ? '' : 's'}`;
            })()}
          </div>
        </div>
        
        <div className="space-y-4">
          {clientCompliance.map((clientComp) => (
            <div key={clientComp.client.clientId} className={`border rounded-lg p-4 ${getStatusColor(clientComp.status)}`}>
              <div className="flex items-start">
                <div className="flex-shrink-0 mr-3 mt-1">
                  {getStatusIcon(clientComp.status)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <img 
                      src={getClientIcon(clientComp.client.type)} 
                      alt={`${clientComp.client.type} icon`} 
                      className="w-4 h-4"
                    />
                    <Link href={`/clients/${clientComp.client.clientId}`} className="text-lg font-medium text-blue-600 hover:text-blue-800 hover:underline">
                      {clientComp.client.name}
                    </Link>
                    <span className="text-sm text-gray-500">({clientComp.client.type})</span>
                  </div>
                  
                  {clientComp.issues.length > 0 ? (
                    <div className="space-y-1">
                      {clientComp.issues.map((issue, index) => (
                        <div key={index} className="text-sm text-gray-600">
                          {issue}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-green-700">
                      Client is compliant with all security guidance
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>


    </div>
  );
} 