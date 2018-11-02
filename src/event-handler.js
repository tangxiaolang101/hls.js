/*
*
* All objects in the event handling chain should inherit from this class
*
*/

import { logger } from './utils/logger';
import { ErrorTypes, ErrorDetails } from './errors';
import Event from './events';

const DEBUG_LOG_ENABLED_DEFAULT = false;

const FORBIDDEN_EVENT_NAMES = [
  'hlsEventGeneric',
  'hlsHandlerDestroying',
  'hlsHandlerDestroyed'
];

class EventHandler {
  constructor (hls, ...events) {
    this.hls = hls;
    this.onEvent = this.onEvent.bind(this);
    this.handledEvents = events;
    this.useGenericHandler = true;

    /**
     * @member {boolean} _debugLogEnabled
     * @private
     */
    this._debugLogEnabled = DEBUG_LOG_ENABLED_DEFAULT;

    this.registerListeners();
  }

  destroy () {
    this.onHandlerDestroying();
    this.unregisterListeners();
    this.onHandlerDestroyed();
  }

  onHandlerDestroying () {}
  onHandlerDestroyed () {}

  isEventHandler () {
    return typeof this.handledEvents === 'object' && this.handledEvents.length && typeof this.onEvent === 'function';
  }

  registerListeners () {
    if (this.isEventHandler()) {
      this.handledEvents.forEach(function (event) {
        if (FORBIDDEN_EVENT_NAMES.indexOf(event) >= 0) {
          throw new Error('Forbidden event-name: ' + event);
        }

        this.hls.on(event, this.onEvent);
      }, this);
    }
  }

  unregisterListeners () {
    if (this.isEventHandler()) {
      this.handledEvents.forEach(function (event) {
        this.hls.off(event, this.onEvent);
      }, this);
    }
  }

  /**
   * arguments: event (string), data (any)
   */
  onEvent (event, data) {
    this.onEventGeneric(event, data);
  }

  onEventGeneric (event, data) {
    if (this._debugLogEnabled) {
      logger.debug('Enter handling event:', event);
    }

    let eventToFunction = function (event, data) {
      let funcName = 'on' + event.replace('hls', '');
      if (typeof this[funcName] !== 'function') {
        throw new Error(`Event ${event} has no generic handler in this ${this.constructor.name} class (tried ${funcName})`);
      }

      return this[funcName].bind(this, data);
    };
    try {
      eventToFunction.call(this, event, data).call();
    } catch (err) {
      logger.error(`An internal error happened while handling event ${event}. Error message: "${err.message}". Here is a stacktrace:`, err);
      this.hls.trigger(Event.ERROR, { type: ErrorTypes.OTHER_ERROR, details: ErrorDetails.INTERNAL_EXCEPTION, fatal: false, event: event, err: err });
    }

    if (this._debugLogEnabled) {
      logger.debug('Done handling event:', event);
    }
  }

  setDebugLogEnabled (enabled) {
    this._debugLogEnabled = enabled;
  }
}

export default EventHandler;
