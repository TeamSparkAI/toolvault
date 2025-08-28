import { NextRequest } from 'next/server';
import { ModelFactory } from '@/lib/models';
import { JsonResponse } from '@/lib/jsonResponse';
import { logger } from '@/lib/logging/server';
import { PolicyElementType, PolicyElementFilter } from '@/lib/models/types/policyElement';
import { ConditionRegistry } from '@/lib/policy-engine/conditions/registry/ConditionRegistry';
import { ActionRegistry } from '@/lib/policy-engine/actions/registry/ActionRegistry';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const elementType = searchParams.get('elementType') as PolicyElementType | null;
        const enabled = searchParams.get('enabled');
        
        const filter: PolicyElementFilter = {};
        if (elementType) filter.elementType = elementType;
        if (enabled !== null) filter.enabled = enabled === 'true';
        
        const policyElementModel = await ModelFactory.getInstance().getPolicyElementModel();
        const elements = await policyElementModel.list(filter);
        
        // Populate metadata from element classes
        const elementsWithMetadata = elements.map(element => {
            let elementClass = null;
            if (element.elementType === 'condition') {
                elementClass = ConditionRegistry.getCondition(element.className);
            } else if (element.elementType === 'action') {
                elementClass = ActionRegistry.getAction(element.className);
            }
            
            return {
                ...element,
                name: elementClass?.name || element.className,
                description: elementClass?.description || '',
                paramsSchema: elementClass?.paramsSchema || null,
                configSchema: elementClass?.configSchema || null
            };
        });
        
        return JsonResponse.payloadResponse('policyElements', elementsWithMetadata);
    } catch (error) {
        logger.error('Error listing policy elements:', error);
        return JsonResponse.errorResponse(500, 'Failed to list policy elements');
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { className, elementType, config, enabled } = body;

        // Basic validation
        if (!className || !elementType) {
            return JsonResponse.errorResponse(400, 'className and elementType are required');
        }

        if (!['filter', 'action'].includes(elementType)) {
            return JsonResponse.errorResponse(400, 'elementType must be "filter" or "action"');
        }

        // Validate that className exists in available classes
        let elementClass = null;
        if (elementType === 'filter') {
            elementClass = ConditionRegistry.getCondition(className);
        } else if (elementType === 'action') {
            elementClass = ActionRegistry.getAction(className);
        }

        if (!elementClass) {
            return JsonResponse.errorResponse(400, `Unknown ${elementType} class: ${className}`);
        }

        // Validate config using element class validator if provided
        if (config !== undefined && elementClass.configValidator) {
            const configValidation = elementClass.configValidator(config);
            if (!configValidation.isValid) {
                return JsonResponse.errorResponse(400, `Invalid config: ${configValidation.error}`);
            }
        }

        const policyElementModel = await ModelFactory.getInstance().getPolicyElementModel();
        const element = await policyElementModel.create({
            className,
            elementType,
            config,
            enabled
        });

        return JsonResponse.payloadResponse('policyElement', element);
    } catch (error) {
        logger.error('Error creating policy element:', error);
        return JsonResponse.errorResponse(500, 'Failed to create policy element');
    }
}
