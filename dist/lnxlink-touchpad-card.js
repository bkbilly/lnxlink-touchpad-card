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
    this._longPressThreshold = config.long_press_threshold || 300;
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

    // --- New Scroll Variables ---
    this._isTwoFingerDrag = false;
    this._twoFingerLastY = 0;
    this._scrollAccumulator = 0;
    this._scrollSensitivity = config.scroll_sensitivity || 20; // Pixels needed to trigger one scroll
    // ---------------------------

    this.innerHTML = `
      <div id="pad" style="
        width:100%;
        height:100%;
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
      // Allow moving if dragging OR if doing a two-finger drag
      if (this._isDragging || this._isTwoFingerDrag) {
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
    
    // Check for Two Finger Start
    if (e.touches && e.touches.length === 2) {
      this._isTwoFingerTap = true;
      this._isTwoFingerDrag = true;
      // Calculate average Y of both fingers
      this._twoFingerLastY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      this._scrollAccumulator = 0;
      console.log("Two-finger touch detected (Potential Scroll)");
      return;
    }
    
    this._isTwoFingerTap = false;
    this._isTwoFingerDrag = false;
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
    // --- Scroll Logic (Two Fingers) ---
    if (this._isTwoFingerDrag && e.touches && e.touches.length === 2) {
      const currentY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const dy = currentY - this._twoFingerLastY;
      
      // If moved significantly, it is definitely a scroll, not a tap
      if (Math.abs(dy) > 2) {
        this._hasMoved = true; // Prevents "Right Click" on release
      }

      this._scrollAccumulator += dy;
      this._twoFingerLastY = currentY;

      // Threshold check for Scroll Down (fingers move UP on screen visually, but physical move is down?)
      // Standard Touchpad: Fingers move UP = Scroll DOWN content. 
      // Let's stick to direct mapping: 
      // Fingers UP (negative dy) -> Scroll Up Action
      // Fingers DOWN (positive dy) -> Scroll Down Action
      
      while (this._scrollAccumulator < -this._scrollSensitivity) {
        console.log("Scrolling UP");
        this._handleScrollUp();
        this._scrollAccumulator += this._scrollSensitivity;
      }
      
      while (this._scrollAccumulator > this._scrollSensitivity) {
        console.log("Scrolling DOWN");
        this._handleScrollDown();
        this._scrollAccumulator -= this._scrollSensitivity;
      }
      return;
    }
    // ----------------------------------

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

      // console.log(`Sending coords: ${x},${y}`);

      const [domain] = this.config.coord_entity.split(".");
      let service, serviceData;
      
      service = "set_value";
      serviceData = {
        entity_id: this.config.coord_entity,
        value: `${x},${y}`
      };
      
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
    
    // Two Finger End Logic
    if (this._isTwoFingerTap) {
      // If we haven't moved significantly, it's a right click
      if (!this._hasMoved) {
        console.log("Two-finger tap detected - right click");
        this._handleRightClick();
      }
      // Reset scroll/two-finger state
      this._isTwoFingerTap = false;
      this._isTwoFingerDrag = false;
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
    this._isTwoFingerDrag = false; // Ensure this is reset
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

  _handleScrollUp() {
    if (!this.config.scroll_up_action || !this._hass) return;
    this._executeAction(this.config.scroll_up_action);
  }

  _handleScrollDown() {
    if (!this.config.scroll_down_action || !this._hass) return;
    this._executeAction(this.config.scroll_down_action);
  }

  _handleTap(e) {
    console.log("Tap detected - left click");
    if (navigator.vibrate) navigator.vibrate(10);
    if (!this.config.tap_action || !this._hass) return;
    this._executeAction(this.config.tap_action);
    this._flashIndicator("rgba(0,150,255,0.8)");
  }

  _handleRightClick() {
    console.log("Right click action");
    if (navigator.vibrate) navigator.vibrate(15);
    if (!this.config.right_click_action || !this._hass) return;
    this._executeAction(this.config.right_click_action);
    this._flashIndicator("rgba(255,100,0,0.8)");
  }
  
  _flashIndicator(color) {
    const indicator = this.querySelector("#indicator");
    if (indicator) {
      indicator.style.background = color;
      setTimeout(() => {
        indicator.style.background = "rgba(255,255,255,0.3)";
      }, 200);
    }
  }

  _startDrag() {
    if (!this.config.drag_start_action || !this._hass) return;
    this._isMouseDown = true;
    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
    
    const dragIndicator = this.querySelector("#drag-indicator");
    if (dragIndicator) dragIndicator.style.display = "block";
    
    const pad = this.querySelector("#pad");
    if (pad) pad.style.background = "#8b5a3c";
    
    this._executeAction(this.config.drag_start_action);
    this._resetDragInactivityTimer();
  }

  _resetDragInactivityTimer() {
    if (this._dragInactivityTimer) clearTimeout(this._dragInactivityTimer);
    this._dragInactivityTimer = setTimeout(() => {
      if (this._isMouseDown) {
        this._releaseDrag();
        this._cancel();
      }
    }, this._dragInactivityTimeout);
  }

  _releaseDrag() {
    if (!this.config.drag_end_action || !this._hass) return;
    this._isMouseDown = false;
    if (navigator.vibrate) navigator.vibrate(20);
    if (this._dragInactivityTimer) {
      clearTimeout(this._dragInactivityTimer);
      this._dragInactivityTimer = null;
    }
    
    const dragIndicator = this.querySelector("#drag-indicator");
    if (dragIndicator) dragIndicator.style.display = "none";
    
    const pad = this.querySelector("#pad");
    if (pad) pad.style.background = "#6d767e";
    
    this._executeAction(this.config.drag_end_action);
  }

  _executeAction(action) {
    if (action.action === "call-service" && action.service) {
      const [domain, service] = action.service.split(".");
      const serviceData = action.service_data || action.data || {};
      this._hass.callService(domain, service, serviceData);
    } else if (action.action && action.action.includes(".")) {
      const [domain, service] = action.action.split(".");
      const target = action.target || {};
      const serviceData = { ...target, ...(action.data || {}) };
      this._hass.callService(domain, service, serviceData);
    } else if (action.action === "navigate" && action.navigation_path) {
      window.history.pushState(null, "", action.navigation_path);
      window.dispatchEvent(new Event("location-changed"));
    } else if (action.action === "url" && action.url_path) {
      window.open(action.url_path, "_blank");
    } else if (action.action === "toggle") {
      const entityId = action.entity || action.entity_id;
      if (entityId) {
        const [domain] = entityId.split(".");
        this._hass.callService(domain, "toggle", { entity_id: entityId });
      }
    } else {
      const event = new Event("hass-action", { bubbles: true, composed: true });
      event.detail = { config: { tap_action: action }, action: "tap" };
      this.dispatchEvent(event);
    }
  }

  getCardSize() { return 3; }

  getLayoutOptions() {
    return {
      grid_columns: 4, grid_min_columns: 2, grid_max_columns: 12,
      grid_rows: 5, grid_min_rows: 2, grid_max_rows: 8
    };
  }

  static getConfigElement() {
    return document.createElement("lnxlink-touchpad-editor");
  }

  static getStubConfig() {
    return {
      coord_entity: "",
      sensitivity: 1.0,
      acceleration: 1.5,
      scroll_sensitivity: 20,
      long_press_threshold: 500,
      movement_threshold: 5,
      drag_inactivity_timeout: 600,
      tap_action: { action: "none" },
      right_click_action: { action: "none" },
      scroll_up_action: { action: "none" },
      scroll_down_action: { action: "none" },
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
      scroll_sensitivity: 20,
      long_press_threshold: 500,
      movement_threshold: 5,
      drag_inactivity_timeout: 600,
      tap_action: { action: "none" },
      right_click_action: { action: "none" },
      scroll_up_action: { action: "none" },
      scroll_down_action: { action: "none" },
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

    if (!this.shadowRoot && !this._container) {
      this._container = document.createElement('div');
      this.appendChild(this._container);
    }

    const container = this.shadowRoot || this._container;
    
    container.innerHTML = `
      <style>
        .config-row { display: flex; align-items: center; margin-bottom: 12px; }
        .config-row > * { flex: 1; margin-left: 8px; }
        .config-row > *:first-child { margin-left: 0; flex: 0 0 40%; }
        ha-selector { width: 100%; }
        .header { font-weight: 500; margin-top: 16px; margin-bottom: 8px; padding-top: 16px; border-top: 1px solid var(--divider-color); }
        .header:first-child { margin-top: 0; padding-top: 0; border-top: none; }
      </style>
      
      <div class="header">Required Settings</div>
      <div class="config-row">
        <label>Coordinate Entity</label>
        <div class="selector-container" data-selector="coord_entity"></div>
      </div>

      <div class="header">Movement & Scroll Settings</div>
      <div class="config-row">
        <label>Sensitivity</label>
        <div class="selector-container" data-selector="sensitivity"></div>
      </div>
      <div class="config-row">
        <label>Acceleration</label>
        <div class="selector-container" data-selector="acceleration"></div>
      </div>
      <div class="config-row">
        <label>Scroll Sensitivity (px)</label>
        <div class="selector-container" data-selector="scroll_sensitivity"></div>
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
        <label>Right Click Action (2 Fingers Tap)</label>
        <div class="selector-container" data-selector="right_click_action"></div>
      </div>
      <div class="config-row">
        <label>Scroll Up Action (2 Fingers Up)</label>
        <div class="selector-container" data-selector="scroll_up_action"></div>
      </div>
      <div class="config-row">
        <label>Scroll Down Action (2 Fingers Down)</label>
        <div class="selector-container" data-selector="scroll_down_action"></div>
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

    this._createSelector('coord_entity', { entity: { domain: ["input_text", "text"] } }, this._config.coord_entity, this._handleChange.bind(this, 'coord_entity'));
    this._createSelector('sensitivity', { number: { min: 0.1, max: 5.0, step: 0.1, mode: "box" } }, this._config.sensitivity, this._handleChange.bind(this, 'sensitivity'));
    this._createSelector('acceleration', { number: { min: 1.0, max: 5.0, step: 0.1, mode: "box" } }, this._config.acceleration, this._handleChange.bind(this, 'acceleration'));
    this._createSelector('scroll_sensitivity', { number: { min: 5, max: 100, step: 5, mode: "box" } }, this._config.scroll_sensitivity, this._handleChange.bind(this, 'scroll_sensitivity'));
    this._createSelector('movement_threshold', { number: { min: 1, max: 50, step: 1, mode: "box" } }, this._config.movement_threshold, this._handleChange.bind(this, 'movement_threshold'));
    this._createSelector('long_press_threshold', { number: { min: 100, max: 2000, step: 50, mode: "box" } }, this._config.long_press_threshold, this._handleChange.bind(this, 'long_press_threshold'));
    this._createSelector('drag_inactivity_timeout', { number: { min: 100, max: 5000, step: 100, mode: "box" } }, this._config.drag_inactivity_timeout, this._handleChange.bind(this, 'drag_inactivity_timeout'));
    
    this._createSelector('tap_action', { "ui-action": {} }, this._config.tap_action, this._handleChange.bind(this, 'tap_action'));
    this._createSelector('right_click_action', { "ui-action": {} }, this._config.right_click_action, this._handleChange.bind(this, 'right_click_action'));
    this._createSelector('scroll_up_action', { "ui-action": {} }, this._config.scroll_up_action, this._handleChange.bind(this, 'scroll_up_action'));
    this._createSelector('scroll_down_action', { "ui-action": {} }, this._config.scroll_down_action, this._handleChange.bind(this, 'scroll_down_action'));
    this._createSelector('drag_start_action', { "ui-action": {} }, this._config.drag_start_action, this._handleChange.bind(this, 'drag_start_action'));
    this._createSelector('drag_end_action', { "ui-action": {} }, this._config.drag_end_action, this._handleChange.bind(this, 'drag_end_action'));
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

  _handleChange(key, ev) {
    if (!this._config) return;
    this._config[key] = ev.detail.value;
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

window.customCards = window.customCards || [];
window.customCards.push({
  type: "lnxlink-touchpad",
  name: "LnxLink Touchpad",
  description: "Virtual touchpad for controlling mouse movements via LnxLink",
  preview: false,
  documentationURL: "https://github.com/your-repo/lnxlink-touchpad"
});