'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useLayout } from '../contexts/LayoutContext';
import { useAlerts } from '../contexts/AlertsContext';
import { useCompliance } from '../contexts/ComplianceContext';

interface LayoutProps {
  children: React.ReactNode;
}

interface MenuItem {
  label: string;
  path?: string;
  icon?: React.ReactNode;
  items?: MenuItem[];
  external?: boolean;
  headerTitle?: string;
}

interface BreadcrumbItem {
  label: string;
  path: string;
}

export default function Layout({ children }: LayoutProps) {
  const pathname = usePathname();
  const { headerAction, headerTitle } = useLayout();
  const { unseenAlerts } = useAlerts();
  const { complianceCount } = useCompliance();

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/' || pathname === '/dashboard';
    }
    return pathname === path || pathname?.startsWith(`${path}/`);
  };

  // Helper function to find menu item by path
  const findMenuItemByPath = (path: string): MenuItem | undefined => {
    // Special case for dashboard
    if (path === '/' || path === '/dashboard') {
      return menuItems.find(item => item.path === '/');
    }

    // Check direct menu items
    const directItem = menuItems.find(item => item.path === path);
    if (directItem) return directItem;

    // Check submenu items
    for (const item of menuItems) {
      if (item.items) {
        const subItem = item.items.find(subItem => subItem.path === path);
        if (subItem) return subItem;
      }
    }
    return undefined;
  };

  // Helper function to get breadcrumb items
  const getBreadcrumbItems = (): BreadcrumbItem[] => {
    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];
    let currentPath = '';

    // Find the actual menu item for the current path (ignoring visual grouping items)
    const findActualMenuItem = (path: string): MenuItem | undefined => {
      // First check direct menu items
      const directItem = menuItems.find(item => item.path === path);
      if (directItem) return directItem;

      // Then check submenu items (ignoring the parent grouping item)
      for (const item of menuItems) {
        if (item.items) {
          const subItem = item.items.find(subItem => subItem.path === path);
          if (subItem) return subItem;
        }
      }
      return undefined;
    };

    // Build breadcrumbs for each segment
    for (const segment of segments) {
      currentPath += `/${segment}`;
      const menuItem = findActualMenuItem(currentPath);
      
      if (menuItem) {
        breadcrumbs.push({
          label: menuItem.headerTitle || menuItem.label,
          path: currentPath
        });
      } else if (currentPath.startsWith('/servers/')) {
        // Special handling for server detail pages
        breadcrumbs.push({
          label: headerTitle || segment,
          path: currentPath
        });
      } else if (currentPath.startsWith('/catalog/')) {
        // Special handling for catalog detail pages
        breadcrumbs.push({
          label: headerTitle || 'Server Details',
          path: currentPath
        });
      } else if (currentPath.startsWith('/clients/')) {
        // Special handling for client detail pages
        breadcrumbs.push({
          label: headerTitle || segment.charAt(0).toUpperCase() + segment.slice(1),
          path: currentPath
        });
      } else if (currentPath.startsWith('/policies/')) {
        // Special handling for policy detail pages
        breadcrumbs.push({
          label: headerTitle || segment,
          path: currentPath
        });
      } else if (currentPath.startsWith('/messages/')) {
        // Special handling for message detail pages
        breadcrumbs.push({
          label: headerTitle || segment,
          path: currentPath
        });
      } else {
        // Fallback for unknown paths
        breadcrumbs.push({
          label: segment.charAt(0).toUpperCase() + segment.slice(1),
          path: currentPath
        });
      }
    }

    // If we're at the root (Dashboard), add it
    if (pathname === '/') {
      const dashboardItem = menuItems.find(item => item.path === '/');
      if (dashboardItem) {
        breadcrumbs.push({
          label: dashboardItem.headerTitle || dashboardItem.label,
          path: '/'
        });
      }
    }

    return breadcrumbs;
  };

  const menuItems: MenuItem[] = [
    { 
      label: 'Dashboard', 
      path: '/',
      headerTitle: 'Dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    { 
      label: 'Server Catalog', 
      path: '/catalog',
      headerTitle: 'Server Catalog',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    },
    { 
      label: 'Manage',
      items: [
        { 
          label: 'Servers', 
          path: '/servers',
          headerTitle: 'Servers',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
          )
        },
        { 
          label: 'Clients', 
          path: '/clients',
          headerTitle: 'Clients',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          )
        },
        { 
          label: 'Policies', 
          path: '/policies',
          headerTitle: 'Policies',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          )
        },
      ]
    },
    {
      label: 'Review',
      items: [
        { 
          label: 'Compliance', 
          path: '/compliance',
          headerTitle: 'Compliance Review',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2h-2M8 4a2 2 0 002 2h2a2 2 0 002-2M8 4a2 2 0 012-2h2a2 2 0 012 2M8 9h6M8 12h6M8 15h6" />
            </svg>
          )
        },
        { 
          label: 'Alerts', 
          path: '/alerts',
          headerTitle: 'Alert Review',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          )
        },
        { 
          label: 'Messages', 
          path: '/messages',
          headerTitle: 'Message Review',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          )
        },
      ]
    },
    { 
      label: 'Settings', 
      path: '/settings',
      headerTitle: 'System Settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    { 
      label: 'API', 
      path: '/api',
      headerTitle: 'API Documentation',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    { 
      label: 'Help', 
      path: '/help',
      headerTitle: 'Help & Support',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left Menu */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo and Title */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Image src="/icon.png" alt="TeamSpark" width={48} height={48} />
            <div className="text-xl font-semibold">
              TeamSpark<br />MCP Tool Vault
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 overflow-y-auto py-4">
          {menuItems.map((item, index) => (
            <div key={index}>
              {item.items ? (
                <>
                  <div className="px-4 py-2 text-base font-medium text-gray-500">
                    {item.label}
                  </div>
                  {item.items.map((subItem, subIndex) => (
                    <Link
                      key={subIndex}
                      href={subItem.path || '#'}
                      className={`flex items-center px-8 py-2 text-base ${
                        isActive(subItem.path || '')
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      {subItem.icon && (
                        <span className="mr-3">{subItem.icon}</span>
                      )}
                      <span className="flex items-center">
                        {subItem.label}
                        {subItem.path === '/alerts' && unseenAlerts.total > 0 && (
                          <span className="ml-2 bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
                            {unseenAlerts.total}
                          </span>
                        )}
                        {subItem.path === '/compliance' && complianceCount > 0 && (
                          <span className="ml-2 bg-orange-100 text-orange-800 text-xs font-medium px-2 py-0.5 rounded-full">
                            {complianceCount}
                          </span>
                        )}
                      </span>
                    </Link>
                  ))}
                </>
              ) : (
                <Link
                  href={item.path || '#'}
                  target={item.external ? '_blank' : undefined}
                  className={`flex items-center px-4 py-2 text-base ${
                    isActive(item.path || '')
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {item.icon}
                  <span className="ml-3">{item.label}</span>
                </Link>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Breadcrumb */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              {getBreadcrumbItems().map((item, index) => {
                const menuItem = findMenuItemByPath(item.path);
                return (
                  <React.Fragment key={item.path}>
                    {index > 0 && (
                      <span className="text-gray-400">/</span>
                    )}
                    {index === getBreadcrumbItems().length - 1 ? (
                      <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
                        {menuItem?.icon && (
                          <span className="mr-4 scale-150">{menuItem.icon}</span>
                        )}
                        {item.label}
                      </h1>
                    ) : (
                      <Link
                        href={item.path}
                        className="text-2xl font-semibold text-gray-900 hover:text-blue-600 flex items-center"
                      >
                        {menuItem?.icon && (
                          <span className="mr-4 scale-150">{menuItem.icon}</span>
                        )}
                        {item.label}
                      </Link>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            <div className="flex gap-2">
              {headerAction}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
} 