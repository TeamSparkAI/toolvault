'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { parse } from 'yaml'

// Dynamically import SwaggerUIWrapper with no SSR
const SwaggerUIWrapper = dynamic(() => import('../components/SwaggerUIWrapper'), {
  ssr: false,
  loading: () => <div className="text-center">Loading API documentation...</div>
})

export default function ApiPage() {
  const [spec, setSpec] = useState<any>(null)

  useEffect(() => {
    fetch('/openapi.yaml')
      .then(response => response.text())
      .then(text => {
        const yaml = parse(text)
        setSpec(yaml)
      })
  }, [])

  if (!spec) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-4">
          <div className="text-center">Loading API documentation...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-4">
        <SwaggerUIWrapper spec={spec} />
      </div>
    </div>
  )
} 