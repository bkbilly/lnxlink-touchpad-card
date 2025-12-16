console.info("lnxlink-touchpad loaded");

class LnxlinkTouchpad extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
  }

  setConfig(config) {
    this.config = config || {};
    
    if (!this.config.coord_entity) {
      console.warn("coord_entity not configured yet");
      this.innerHTML = `
        <ha-card>
          <div style="padding: 16px; text-align: center; color: var(--error-color);">
            Please configure the coordinate entity in the card settings
          </div>
        </ha-card>
      `;
      return;
    }
    this._lastX = null;
    this._lastY = null;
    this._startX = null;
    this._startY = null;
    this._isDragging = false;
    this._hasMoved = false;
    this._longPressTimer = null;
    this._isLongPress = false;
    this._longPressThreshold = config.long_press_threshold || 500;
    this._movementThreshold = config.movement_threshold || 5;
    this._isTouchDevice = false;
    this._lastTouchTime = 0;
    this._lastMoveTime = 0;
    this._sensitivity = config.sensitivity || 1.0;
    this._acceleration = config.acceleration || 1.5;
    this._isMouseDown = false;
    this._isTwoFingerTap = false;
    this._dragInactivityTimer = null;
    this._dragInactivityTimeout = config.drag_inactivity_timeout || 600;

    this.innerHTML = `
      <div id="pad" style="
        width:100%;
        height:250px;
        background:#6d767e;
        border-radius:16px;
        border:1px solid black;
        touch-action:none;
        display:flex;
        align-items:center;
        justify-content:center;
        color:white;
        user-select:none;
        cursor:pointer;
        position:relative;
      ">
        <span id="label">Touchpad</span>
        <div id="drag-indicator" style="
          position:absolute;
          top:10px;
          left:10px;
          padding:4px 8px;
          background:rgba(255,100,0,0.9);
          border-radius:4px;
          font-size:12px;
          font-weight:bold;
          display:none;
        ">DRAG MODE</div>
        <div id="indicator" style="
          position:absolute;
          top:10px;
          right:10px;
          width:10px;
          height:10px;
          background:rgba(255,255,255,0.3);
          border-radius:50%;
          transition:background 0.2s;
        "></div>
      </div>
    `;

    const pad = this.querySelector("#pad");

    pad.addEventListener("mousedown", e => {
      if (Date.now() - this._lastTouchTime < 500) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      this._start(e);
    });

    pad.addEventListener("mousemove", e => {
      if (this._isDragging) {
        e.preventDefault();
        this._move(e);
      }
    });

    pad.addEventListener("mouseup", e => {
      if (Date.now() - this._lastTouchTime < 500) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      this._end(e);
    });

    pad.addEventListener("mouseleave", () => this._cancel());

    pad.addEventListener("touchstart", e => {
      this._lastTouchTime = Date.now();
      this._isTouchDevice = true;
      this._start(e);
    }, { passive: true });

    pad.addEventListener("touchmove", e => {
      this._move(e);
    }, { passive: true });

    pad.addEventListener("touchend", e => {
      this._end(e);
    }, { passive: true });

    pad.addEventListener("touchcancel", () => this._cancel());
  }

  _start(e) {
    const p = e.touches ? e.touches[0] : e;
    
    if (e.touches && e.touches.length === 2) {
      this._isTwoFingerTap = true;
      console.log("Two-finger touch detected");
      return;
    }
    
    this._isTwoFingerTap = false;
    this._lastX = p.clientX;
    this._lastY = p.clientY;
    this._startX = p.clientX;
    this._startY = p.clientY;
    this._isDragging = true;
    this._hasMoved = false;
    this._isLongPress = false;
    this._lastMoveTime = Date.now();
    
    this._longPressTimer = setTimeout(() => {
      if (this._isDragging && !this._hasMoved && !this._isMouseDown) {
        this._isLongPress = true;
        console.log("Long press detected - starting drag mode");
        this._startDrag();
      }
    }, this._longPressThreshold);
    
    const indicator = this.querySelector("#indicator");
    if (indicator) {
      indicator.style.background = "rgba(0,255,0,0.8)";
    }
  }

  _move(e) {
    if (!this._isDragging || this._lastX === null || !this._hass) return;

    const p = e.touches ? e.touches[0] : e;
    const currentTime = Date.now();
    const timeDelta = Math.max(currentTime - this._lastMoveTime, 1);

    let dx = p.clientX - this._lastX;
    let dy = p.clientY - this._lastY;

    if (dx === 0 && dy === 0) return;

    const totalDx = Math.abs(p.clientX - this._startX);
    const totalDy = Math.abs(p.clientY - this._startY);
    const totalDistance = Math.sqrt(totalDx * totalDx + totalDy * totalDy);

    if (totalDistance > this._movementThreshold) {
      this._hasMoved = true;
      
      if (this._longPressTimer) {
        clearTimeout(this._longPressTimer);
        this._longPressTimer = null;
      }
    }

    if (this._hasMoved) {
      const distance = Math.sqrt(dx * dx + dy * dy);
      const velocity = distance / timeDelta;
      const accelerationMultiplier = 1 + (velocity * this._acceleration);
      
      dx = Math.round(dx * this._sensitivity * accelerationMultiplier);
      dy = Math.round(dy * this._sensitivity * accelerationMultiplier);

      this._lastX = p.clientX;
      this._lastY = p.clientY;
      this._lastMoveTime = currentTime;

      const x = dx >= 0 ? `+${dx}` : `${dx}`;
      const y = dy >= 0 ? `+${dy}` : `${dy}`;

      console.log(`Sending coords: ${x},${y} (velocity: ${velocity.toFixed(2)}, multiplier: ${accelerationMultiplier.toFixed(2)})`);

      const [domain] = this.config.coord_entity.split(".");
      let service, serviceData;
      
      if (domain === "input_text") {
        service = "set_value";
        serviceData = {
          entity_id: this.config.coord_entity,
          value: `${x},${y}`
        };
      } else if (domain === "text") {
        service = "set_value";
        serviceData = {
          entity_id: this.config.coord_entity,
          value: `${x},${y}`
        };
      } else {
        service = "set_value";
        serviceData = {
          entity_id: this.config.coord_entity,
          value: `${x},${y}`
        };
      }
      
      this._hass.callService(domain, service, serviceData);
      
      if (this._isMouseDown) {
        this._resetDragInactivityTimer();
      }
    }
  }

  _end(e) {
    if (this._longPressTimer) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }
    
    if (this._isTwoFingerTap && !this._hasMoved) {
      console.log("Two-finger tap detected - right click");
      this._handleRightClick();
      this._isTwoFingerTap = false;
      this._cancel();
      return;
    }
    
    if (this._isMouseDown && !this._hasMoved) {
      console.log("Releasing drag");
      this._releaseDrag();
      this._cancel();
      return;
    }
    
    if (this._isLongPress) {
      if (!this._isMouseDown) {
        this._cancel();
      } else {
        this._isDragging = false;
        this._lastX = null;
        this._lastY = null;
        this._startX = null;
        this._startY = null;
        this._hasMoved = false;
        this._isLongPress = false;
        
        const indicator = this.querySelector("#indicator");
        if (indicator) {
          indicator.style.background = "rgba(255,255,255,0.3)";
        }
      }
      return;
    }
    
    if (this._isDragging && !this._hasMoved) {
      this._handleTap(e);
    }
    
    this._cancel();
  }

  _cancel() {
    if (this._longPressTimer) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }
    
    if (this._dragInactivityTimer && !this._isMouseDown) {
      clearTimeout(this._dragInactivityTimer);
      this._dragInactivityTimer = null;
    }
    
    this._isDragging = false;
    this._lastX = null;
    this._lastY = null;
    this._startX = null;
    this._startY = null;
    this._hasMoved = false;
    this._isLongPress = false;
    
    const indicator = this.querySelector("#indicator");
    if (indicator) {
      indicator.style.background = "rgba(255,255,255,0.3)";
    }
  }

  _handleTap(e) {
    console.log("Tap detected - left click");
    
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
    
    if (!this.config.tap_action || !this._hass) {
      console.log("No tap_action configured or hass not available");
      return;
    }

    const action = this.config.tap_action;
    console.log("Tap action:", action);

    this._executeAction(action);
    
    const indicator = this.querySelector("#indicator");
    if (indicator) {
      indicator.style.background = "rgba(0,150,255,0.8)";
      setTimeout(() => {
        indicator.style.background = "rgba(255,255,255,0.3)";
      }, 200);
    }
  }

  _handleRightClick() {
    console.log("Right click action");
    
    if (navigator.vibrate) {
      navigator.vibrate(15);
    }
    
    if (!this.config.right_click_action || !this._hass) {
      console.log("No right_click_action configured or hass not available");
      return;
    }

    const action = this.config.right_click_action;
    console.log("Right click action:", action);

    this._executeAction(action);
    
    const indicator = this.querySelector("#indicator");
    if (indicator) {
      indicator.style.background = "rgba(255,100,0,0.8)";
      setTimeout(() => {
        indicator.style.background = "rgba(255,255,255,0.3)";
      }, 200);
    }
  }

  _startDrag() {
    if (!this.config.drag_start_action || !this._hass) {
      console.log("No drag_start_action configured");
      return;
    }
    
    this._isMouseDown = true;
    console.log("Starting drag mode");
    
    if (navigator.vibrate) {
      navigator.vibrate([50, 30, 50]);
    }
    
    const dragIndicator = this.querySelector("#drag-indicator");
    if (dragIndicator) {
      dragIndicator.style.display = "block";
    }
    
    const pad = this.querySelector("#pad");
    if (pad) {
      pad.style.background = "#8b5a3c";
    }
    
    this._executeAction(this.config.drag_start_action);
    
    this._resetDragInactivityTimer();
  }

  _resetDragInactivityTimer() {
    if (this._dragInactivityTimer) {
      clearTimeout(this._dragInactivityTimer);
    }
    
    this._dragInactivityTimer = setTimeout(() => {
      if (this._isMouseDown) {
        console.log("Drag inactivity timeout - auto-releasing");
        this._releaseDrag();
        this._cancel();
      }
    }, this._dragInactivityTimeout);
  }

  _releaseDrag() {
    if (!this.config.drag_end_action || !this._hass) {
      console.log("No drag_end_action configured");
      return;
    }
    
    this._isMouseDown = false;
    console.log("Ending drag mode");
    
    if (navigator.vibrate) {
      navigator.vibrate(20);
    }
    
    if (this._dragInactivityTimer) {
      clearTimeout(this._dragInactivityTimer);
      this._dragInactivityTimer = null;
    }
    
    const dragIndicator = this.querySelector("#drag-indicator");
    if (dragIndicator) {
      dragIndicator.style.display = "none";
    }
    
    const pad = this.querySelector("#pad");
    if (pad) {
      pad.style.background = "#6d767e";
    }
    
    this._executeAction(this.config.drag_end_action);
  }

  _executeAction(action) {
    if (action.action === "call-service" && action.service) {
      const [domain, service] = action.service.split(".");
      const serviceData = action.service_data || action.data || {};
      console.log(`Calling service: ${domain}.${service}`, serviceData);
      this._hass.callService(domain, service, serviceData);
    } else if (action.action && action.action.includes(".")) {
      const [domain, service] = action.action.split(".");
      const target = action.target || {};
      const serviceData = { ...target, ...(action.data || {}) };
      console.log(`Calling service: ${domain}.${service}`, serviceData);
      this._hass.callService(domain, service, serviceData);
    } else if (action.action === "navigate" && action.navigation_path) {
      console.log(`Navigating to: ${action.navigation_path}`);
      window.history.pushState(null, "", action.navigation_path);
      window.dispatchEvent(new Event("location-changed"));
    } else if (action.action === "url" && action.url_path) {
      console.log(`Opening URL: ${action.url_path}`);
      window.open(action.url_path, "_blank");
    } else if (action.action === "toggle") {
      const entityId = action.entity || action.entity_id;
      if (entityId) {
        const [domain] = entityId.split(".");
        console.log(`Toggling: ${entityId}`);
        this._hass.callService(domain, "toggle", { entity_id: entityId });
      }
    } else {
      console.log("Dispatching hass-action event");
      const event = new Event("hass-action", {
        bubbles: true,
        composed: true
      });

      event.detail = {
        config: {
          tap_action: action
        },
        action: "tap"
      };

      this.dispatchEvent(event);
    }
  }

  getCardSize() {
    return 3;
  }

  static getConfigElement() {
    return document.createElement("lnxlink-touchpad-editor");
  }

  static getStubConfig() {
    return {
      coord_entity: "",
      sensitivity: 1.0,
      acceleration: 1.5,
      long_press_threshold: 500,
      movement_threshold: 5,
      drag_inactivity_timeout: 600,
      tap_action: { action: "none" },
      right_click_action: { action: "none" },
      drag_start_action: { action: "none" },
      drag_end_action: { action: "none" }
    };
  }
}

class LnxlinkTouchpadEditor extends HTMLElement {
  setConfig(config) {
    this._config = {
      coord_entity: "",
      sensitivity: 1.0,
      acceleration: 1.5,
      long_press_threshold: 500,
      movement_threshold: 5,
      drag_inactivity_timeout: 600,
      tap_action: { action: "none" },
      right_click_action: { action: "none" },
      drag_start_action: { action: "none" },
      drag_end_action: { action: "none" },
      ...config
    };
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered) {
      this.render();
    }
  }

  render() {
    if (!this._hass || !this._config) return;
    this._rendered = true;

    // Create container if it doesn't exist
    if (!this.shadowRoot && !this._container) {
      this._container = document.createElement('div');
      this.appendChild(this._container);
    }

    const container = this.shadowRoot || this._container;
    
    container.innerHTML = `
      <style>
        .config-row {
          display: flex;
          align-items: center;
          margin-bottom: 12px;
        }
        .config-row > * {
          flex: 1;
          margin-left: 8px;
        }
        .config-row > *:first-child {
          margin-left: 0;
          flex: 0 0 40%;
        }
        ha-selector {
          width: 100%;
        }
        .header {
          font-weight: 500;
          margin-top: 16px;
          margin-bottom: 8px;
          padding-top: 16px;
          border-top: 1px solid var(--divider-color);
        }
        .header:first-child {
          margin-top: 0;
          padding-top: 0;
          border-top: none;
        }
      </style>
      
      <div class="header">Required Settings</div>
      
      <div class="config-row">
        <label>Coordinate Entity</label>
        <div class="selector-container" data-selector="coord_entity"></div>
      </div>

      <div class="header">Movement Settings</div>
      
      <div class="config-row">
        <label>Sensitivity</label>
        <div class="selector-container" data-selector="sensitivity"></div>
      </div>

      <div class="config-row">
        <label>Acceleration</label>
        <div class="selector-container" data-selector="acceleration"></div>
      </div>

      <div class="config-row">
        <label>Movement Threshold (px)</label>
        <div class="selector-container" data-selector="movement_threshold"></div>
      </div>

      <div class="header">Timing Settings</div>
      
      <div class="config-row">
        <label>Long Press Threshold (ms)</label>
        <div class="selector-container" data-selector="long_press_threshold"></div>
      </div>

      <div class="config-row">
        <label>Drag Inactivity Timeout (ms)</label>
        <div class="selector-container" data-selector="drag_inactivity_timeout"></div>
      </div>

      <div class="header">Actions</div>
      
      <div class="config-row">
        <label>Tap Action (Left Click)</label>
        <div class="selector-container" data-selector="tap_action"></div>
      </div>

      <div class="config-row">
        <label>Right Click Action</label>
        <div class="selector-container" data-selector="right_click_action"></div>
      </div>

      <div class="config-row">
        <label>Drag Start Action</label>
        <div class="selector-container" data-selector="drag_start_action"></div>
      </div>

      <div class="config-row">
        <label>Drag End Action</label>
        <div class="selector-container" data-selector="drag_end_action"></div>
      </div>
    `;

    // Now create and attach the selectors properly
    this._createSelector('coord_entity', 
      { entity: { domain: ["input_text", "text"] } }, 
      this._config.coord_entity,
      this._coordEntityChanged.bind(this)
    );
    
    this._createSelector('sensitivity',
      { number: { min: 0.1, max: 5.0, step: 0.1, mode: "box" } },
      this._config.sensitivity,
      this._sensitivityChanged.bind(this)
    );
    
    this._createSelector('acceleration',
      { number: { min: 1.0, max: 5.0, step: 0.1, mode: "box" } },
      this._config.acceleration,
      this._accelerationChanged.bind(this)
    );
    
    this._createSelector('movement_threshold',
      { number: { min: 1, max: 50, step: 1, mode: "box" } },
      this._config.movement_threshold,
      this._movementThresholdChanged.bind(this)
    );
    
    this._createSelector('long_press_threshold',
      { number: { min: 100, max: 2000, step: 50, mode: "box" } },
      this._config.long_press_threshold,
      this._longPressChanged.bind(this)
    );
    
    this._createSelector('drag_inactivity_timeout',
      { number: { min: 100, max: 5000, step: 100, mode: "box" } },
      this._config.drag_inactivity_timeout,
      this._dragTimeoutChanged.bind(this)
    );
    
    this._createSelector('tap_action',
      { "ui-action": {} },
      this._config.tap_action,
      this._tapActionChanged.bind(this)
    );
    
    this._createSelector('right_click_action',
      { "ui-action": {} },
      this._config.right_click_action,
      this._rightClickActionChanged.bind(this)
    );
    
    this._createSelector('drag_start_action',
      { "ui-action": {} },
      this._config.drag_start_action,
      this._dragStartActionChanged.bind(this)
    );
    
    this._createSelector('drag_end_action',
      { "ui-action": {} },
      this._config.drag_end_action,
      this._dragEndActionChanged.bind(this)
    );
  }

  _createSelector(name, selector, value, changeHandler) {
    const containerEl = this.querySelector(`[data-selector="${name}"]`);
    if (!containerEl) return;

    const selectorEl = document.createElement('ha-selector');
    selectorEl.hass = this._hass;
    selectorEl.selector = selector;
    selectorEl.value = value;
    selectorEl.addEventListener('value-changed', changeHandler);
    
    containerEl.innerHTML = '';
    containerEl.appendChild(selectorEl);
  }

  _coordEntityChanged(ev) {
    if (!this._config) return;
    this._config.coord_entity = ev.detail.value;
    this._fireConfigChanged();
  }

  _sensitivityChanged(ev) {
    if (!this._config) return;
    this._config.sensitivity = ev.detail.value;
    this._fireConfigChanged();
  }

  _accelerationChanged(ev) {
    if (!this._config) return;
    this._config.acceleration = ev.detail.value;
    this._fireConfigChanged();
  }

  _movementThresholdChanged(ev) {
    if (!this._config) return;
    this._config.movement_threshold = ev.detail.value;
    this._fireConfigChanged();
  }

  _longPressChanged(ev) {
    if (!this._config) return;
    this._config.long_press_threshold = ev.detail.value;
    this._fireConfigChanged();
  }

  _dragTimeoutChanged(ev) {
    if (!this._config) return;
    this._config.drag_inactivity_timeout = ev.detail.value;
    this._fireConfigChanged();
  }

  _tapActionChanged(ev) {
    if (!this._config) return;
    this._config.tap_action = ev.detail.value;
    this._fireConfigChanged();
  }

  _rightClickActionChanged(ev) {
    if (!this._config) return;
    this._config.right_click_action = ev.detail.value;
    this._fireConfigChanged();
  }

  _dragStartActionChanged(ev) {
    if (!this._config) return;
    this._config.drag_start_action = ev.detail.value;
    this._fireConfigChanged();
  }

  _dragEndActionChanged(ev) {
    if (!this._config) return;
    this._config.drag_end_action = ev.detail.value;
    this._fireConfigChanged();
  }

  _fireConfigChanged() {
    const event = new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(event);
  }
}

customElements.define("lnxlink-touchpad", LnxlinkTouchpad);
customElements.define("lnxlink-touchpad-editor", LnxlinkTouchpadEditor);

// Register the card in Home Assistant's card picker
window.customCards = window.customCards || [];
window.customCards.push({
  type: "lnxlink-touchpad",
  name: "LnxLink Touchpad",
  description: "Virtual touchpad for controlling mouse movements via LnxLink",
  preview: false,
  documentationURL: "https://github.com/your-repo/lnxlink-touchpad"
});