import { NextRequest } from 'next/server';
import { ModelFactory } from '@/lib/models';
import { JsonResponse } from '@/lib/jsonResponse';
import { logger } from '@/lib/logging/server';
import { ConditionRegistry } from '@/lib/policy-engine/conditions/registry/ConditionRegistry';
import { ActionRegistry } from '@/lib/policy-engine/actions/registry/ActionRegistry';

export const dynamic = 'force-dynamic';

export async function POST(
    request: NextRequest,
    { params }: { params: { configId: string } }
) {
    try {
        const configId = parseInt(params.configId);
        if (isNaN(configId)) {
            return JsonResponse.errorResponse(400, 'Invalid configId');
        }

        const body = await request.json();
        const { params: elementParams } = body;

        if (!elementParams) {
            return JsonResponse.errorResponse(400, 'params field is required');
        }

        // Get the policy element
        const policyElementModel = await ModelFactory.getInstance().getPolicyElementModel();
        const element = await policyElementModel.findById(configId);
        
        if (!element) {
            return JsonResponse.errorResponse(404, 'Policy element not found');
        }

        // Get the element class for validation
        let elementClass = null;
        if (element.elementType === 'condition') {
            elementClass = ConditionRegistry.getCondition(element.className);
        } else if (element.elementType === 'action') {
            elementClass = ActionRegistry.getAction(element.className);
        }

        if (!elementClass) {
            return JsonResponse.errorResponse(404, 'Element class not found');
        }

        // Validate parameters
        if (elementClass.paramsValidator) {
            const validation = elementClass.paramsValidator(elementParams);
            return JsonResponse.payloadResponse('validation', {
                isValid: validation.isValid,
                errors: validation.isValid ? [] : [validation.error]
            });
        } else {
            // No validator, assume valid
            return JsonResponse.payloadResponse('validation', {
                isValid: true,
                errors: []
            });
        }
    } catch (error) {
        logger.error('Error validating policy element params:', error);
        return JsonResponse.errorResponse(500, 'Failed to validate parameters');
    }
}
