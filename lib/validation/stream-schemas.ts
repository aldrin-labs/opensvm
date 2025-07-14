/**
 * Stream Request Validation Schemas
 * Validates incoming stream API requests
 */

export interface StreamRequestValidation {
  success: boolean;
  data?: any;
  errors?: any;
}

export interface StreamRequestBody {
  action: string;
  clientId?: string;
  eventTypes?: string[];
  authToken?: string;
}

export function validateStreamRequest(body: any): StreamRequestValidation {
  try {
    if (!body || typeof body !== 'object') {
      return {
        success: false,
        errors: { message: 'Request body must be an object' }
      };
    }
    
    const { action, clientId, eventTypes, authToken } = body;
    
    // Validate action
    if (!action || typeof action !== 'string') {
      return {
        success: false,
        errors: { action: 'Action is required and must be a string' }
      };
    }
    
    const validActions = ['authenticate', 'subscribe', 'unsubscribe', 'start_monitoring', 'status'];
    if (!validActions.includes(action)) {
      return {
        success: false,
        errors: { 
          action: `Invalid action. Must be one of: ${validActions.join(', ')}`,
          validActions
        }
      };
    }
    
    // Validate clientId if provided
    if (clientId !== undefined && typeof clientId !== 'string') {
      return {
        success: false,
        errors: { clientId: 'ClientId must be a string' }
      };
    }
    
    // Validate eventTypes if provided
    if (eventTypes !== undefined) {
      if (!Array.isArray(eventTypes)) {
        return {
          success: false,
          errors: { eventTypes: 'EventTypes must be an array' }
        };
      }
      
      if (!eventTypes.every(type => typeof type === 'string')) {
        return {
          success: false,
          errors: { eventTypes: 'All event types must be strings' }
        };
      }
      
      const validEventTypes = ['transaction', 'block', 'account_change', 'all'];
      const invalidTypes = eventTypes.filter(type => !validEventTypes.includes(type));
      if (invalidTypes.length > 0) {
        return {
          success: false,
          errors: { 
            eventTypes: `Invalid event types: ${invalidTypes.join(', ')}. Valid types: ${validEventTypes.join(', ')}`,
            invalidTypes,
            validEventTypes
          }
        };
      }
    }
    
    // Validate authToken if provided
    if (authToken !== undefined && typeof authToken !== 'string') {
      return {
        success: false,
        errors: { authToken: 'AuthToken must be a string' }
      };
    }
    
    return {
      success: true,
      data: { action, clientId, eventTypes, authToken }
    };
    
  } catch (error) {
    return {
      success: false,
      errors: { message: 'Invalid request format', error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

export function validateAnomalyRequest(body: any): StreamRequestValidation {
  try {
    if (!body || typeof body !== 'object') {
      return {
        success: false,
        errors: { message: 'Request body must be an object' }
      };
    }

    // Basic anomaly request validation
    return {
      success: true,
      data: body
    };
    
  } catch (error) {
    return {
      success: false,
      errors: { message: 'Invalid anomaly request format', error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

export function validateBlockchainEvent(event: any): StreamRequestValidation {
  try {
    if (!event || typeof event !== 'object') {
      return {
        success: false,
        errors: { message: 'Event must be an object' }
      };
    }

    const { type, data, timestamp } = event;

    if (!type || typeof type !== 'string') {
      return {
        success: false,
        errors: { type: 'Event type is required and must be a string' }
      };
    }

    const validTypes = ['transaction', 'block', 'account_change'];
    if (!validTypes.includes(type)) {
      return {
        success: false,
        errors: { 
          type: `Invalid event type. Must be one of: ${validTypes.join(', ')}`,
          validTypes
        }
      };
    }

    if (!data) {
      return {
        success: false,
        errors: { data: 'Event data is required' }
      };
    }

    if (timestamp && typeof timestamp !== 'number') {
      return {
        success: false,
        errors: { timestamp: 'Timestamp must be a number' }
      };
    }

    return {
      success: true,
      data: event
    };
    
  } catch (error) {
    return {
      success: false,
      errors: { message: 'Invalid blockchain event format', error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}
