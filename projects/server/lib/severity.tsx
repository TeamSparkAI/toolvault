import React, { ReactNode } from 'react';
import { CriticalIcon, HighIcon, MediumIcon, LowIcon, InfoIcon } from './severity-icons';

export interface SeverityLevel {
  value: number;
  name: string;
  description: string;
  icon: ReactNode;
  color: string;
}

const severityLevels: SeverityLevel[] = [
  {
    value: 1,
    name: 'Critical',
    description: 'Immediate action required, direct breach or imminent threat',
    icon: <CriticalIcon size="md" />,
    color: '#7f1d1d' // deep red/burgundy
  },
  {
    value: 2,
    name: 'High',
    description: 'Urgent attention required, potential security risk',
    icon: <HighIcon size="md" />,
    color: '#dc2626' // red
  },
  {
    value: 3,
    name: 'Medium',
    description: 'Important to address, security best practices violation',
    icon: <MediumIcon size="md" />,
    color: '#f97316' // orange
  },
  {
    value: 4,
    name: 'Low',
    description: 'Should be reviewed, minor policy deviation',
    icon: <LowIcon size="md" />,
    color: '#eab308' // yellow
  },
  {
    value: 5,
    name: 'Info',
    description: 'For awareness only, no immediate action required',
    icon: <InfoIcon size="md" />,
    color: '#16a34a' // green
  }
];

export const getSeverityLevel = (value: number): SeverityLevel => {
  const level = severityLevels.find(level => level.value === value);
  if (!level) {
    throw new Error(`Invalid severity value: ${value}`);
  }
  return level;
};

export const getSeverityLevels = (): SeverityLevel[] => {
  return [...severityLevels]; // Return a copy to prevent modification
};

export const getSeverityOptions = () => {
  return severityLevels.map(level => ({
    value: level.value,
    label: `${level.value} - ${level.name}`
  }));
};

export const getSeverityColor = (severity: number): string => {
  return getSeverityLevel(severity).color;
}; 