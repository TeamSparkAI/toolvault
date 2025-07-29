'use client';

import { useState } from 'react';

interface FAQ {
  question: string;
  answer: string;
}

interface Guide {
  title: string;
  description: string;
  steps: string[];
}

const faqs: FAQ[] = [
  {
    question: 'How do I add a new server?',
    answer: 'To add a new server, navigate to the Servers page and click the "Add Server" button. Fill in the required information in the form and click "Save". The server will be added to your list of managed servers.'
  },
  {
    question: 'What are policies and how do they work?',
    answer: 'Policies are rules that define how your servers should behave and what actions should be taken when certain conditions are met. You can create policies in the Policies page, specifying conditions, severity levels, and actions to take when the policy is triggered.'
  },
  {
    question: 'How do I set up email notifications?',
    answer: 'Go to the Settings page and enable email notifications in the Notifications section. Enter your email address and save the settings. You will receive notifications for important events and alerts.'
  },
  {
    question: 'What do the different alert severity levels mean?',
    answer: 'Alert severity levels indicate the importance of an alert: Critical (highest priority), High, Medium, and Low. Critical alerts require immediate attention, while lower severity alerts can be addressed during regular maintenance.'
  },
  {
    question: 'How do I manage client connections?',
    answer: 'Client connections can be managed from the Clients page. You can view all connected clients, their status, and last seen time. You can also disconnect clients or modify their permissions as needed.'
  }
];

const guides: Guide[] = [
  {
    title: 'Getting Started',
    description: 'Learn the basics of setting up and using the application.',
    steps: [
      'Install the application on your server',
      'Configure your server settings',
      'Add your first server to manage',
      'Set up basic monitoring policies',
      'Configure notifications'
    ]
  },
  {
    title: 'Server Management',
    description: 'Learn how to effectively manage your servers.',
    steps: [
      'Add new servers to the system',
      'Configure server-specific settings',
      'Set up monitoring and alerts',
      'Manage server access and permissions',
      'Monitor server performance and health'
    ]
  },
  {
    title: 'Policy Configuration',
    description: 'Learn how to create and manage policies.',
    steps: [
      'Create a new policy',
      'Define policy conditions',
      'Set severity levels',
      'Configure actions and notifications',
      'Test and deploy policies'
    ]
  },
  {
    title: 'Alert Management',
    description: 'Learn how to handle and respond to alerts.',
    steps: [
      'Monitor active alerts',
      'Acknowledge and resolve alerts',
      'Configure alert notifications',
      'Set up alert escalation rules',
      'Review alert history and trends'
    ]
  }
];

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);

  const filteredFaqs = faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="mb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Search</h2>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for help topics..."
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Frequently Asked Questions</h2>
              <div className="space-y-4">
                {filteredFaqs.map((faq, index) => (
                  <div key={index} className="border-b border-gray-200 pb-4 last:border-0">
                    <h3 className="text-base font-medium text-gray-900 mb-2">{faq.question}</h3>
                    <p className="text-gray-600">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Guides</h2>
            <div className="space-y-6">
              {guides.map((guide, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 cursor-pointer"
                  onClick={() => setSelectedGuide(guide)}
                >
                  <h3 className="text-base font-medium text-gray-900 mb-2">{guide.title}</h3>
                  <p className="text-gray-600 mb-4">{guide.description}</p>
                  <div className="flex items-center text-blue-600">
                    <span>View Guide</span>
                    <svg
                      className="ml-2 h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 space-y-6">
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Contact Support</h2>
              <p className="text-gray-600 mb-4">
                Need additional help? Our support team is here to assist you.
              </p>
              <a
                href="mailto:support@example.com"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Contact Support
              </a>
            </div>

            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Resources</h2>
              <ul className="space-y-2">
                <li>
                  <a
                    href="#"
                    className="text-blue-600 hover:text-blue-800 flex items-center"
                  >
                    <svg
                      className="mr-2 h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      />
                    </svg>
                    Documentation
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-blue-600 hover:text-blue-800 flex items-center"
                  >
                    <svg
                      className="mr-2 h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    Video Tutorials
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-blue-600 hover:text-blue-800 flex items-center"
                  >
                    <svg
                      className="mr-2 h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    Release Notes
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {selectedGuide && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-medium text-gray-900">{selectedGuide.title}</h2>
                <button
                  onClick={() => setSelectedGuide(null)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <p className="text-gray-600 mb-6">{selectedGuide.description}</p>
              <div className="space-y-4">
                {selectedGuide.steps.map((step, index) => (
                  <div key={index} className="flex items-start">
                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600 text-sm font-medium">{index + 1}</span>
                    </div>
                    <p className="ml-3 text-gray-600">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 