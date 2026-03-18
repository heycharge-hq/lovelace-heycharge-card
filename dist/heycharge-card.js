const LitElement = Object.getPrototypeOf(
  customElements.get("ha-panel-lovelace")
);
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

const CARD_VERSION = "2.1.0";

console.info(
  `%c  HEYCHARGE-CARD  \n%c  Version ${CARD_VERSION}  `,
  'color: white; font-weight: bold; background: #00C853',
  'color: #00C853; font-weight: bold; background: white'
);

if (!customElements.get("heycharge-card")) {
  console.log("Registering heycharge-card custom element");
} else {
  console.log("heycharge-card already registered");
}

class HeyChargeCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
      _expanded: { type: Boolean },
      _slidingValue: { type: Number },
      _isSliding: { type: Boolean },
      _pendingSessionAction: { type: String },
    };
  }

  constructor() {
    super();
    this._expanded = false;
    this._slidingValue = null;
    this._isSliding = false;
    this._latchedValue = null;
    this._latchTimeout = null;
    this._pendingSessionAction = null;
    this._sessionActionTimeout = null;
    this._previousSessionActive = null;
    this._cachedEntities = null;
    this._cachedEntitiesTime = 0;
  }

  setConfig(config) {
    if (!config) {
      throw new Error("Invalid configuration");
    }
    this.config = {
      show_company_mode: true,
      show_statistics: true,
      show_advanced: false,
      compact_mode: false,
      ...config,
    };
  }

  static getStubConfig() {
    return {
      entity_prefix: "sensor.heycharge_",
      show_company_mode: true,
      show_statistics: true,
    };
  }

  static getConfigElement() {
    return document.createElement("heycharge-card-editor");
  }

  getCardSize() {
    if (this.config && this.config.compact_mode) return 1;
    let size = 3;
    if (this.config && this.config.show_statistics) size += 1;
    if (this.config && this.config.show_advanced) size += 1;
    return size;
  }

  render() {
    if (!this.hass || !this.config) {
      return html``;
    }

    const deviceId = this._getDeviceId();
    const entities = this._getEntities(deviceId);
    const isCharging = this._isCharging(entities);
    const sessionType = this._getSessionType(entities);
    const chargingPower = this._getChargingPower(entities);
    const chargingCurrent = this._getMaxChargingCurrent(entities);
    const currentLimit = this._getCurrentLimit(entities);
    const currentRequest = this._getCurrentRequest(entities);
    const sessionDuration = this._getSessionDuration(entities);
    const sessionEnergy = this._getSessionEnergy(entities);
    const sessionActive = this._getEntityState(entities, 'session_active', 'off') === 'on';
    const chargerState = this._getEntityState(entities, 'charger_state', 'unknown');
    const hasValidData = this._hasValidData(entities);

    this._checkSessionStateChange(sessionActive);

    if (this.config.compact_mode) {
      return this._renderCompact(entities, isCharging, chargingPower, currentLimit, currentRequest, sessionActive, chargerState, hasValidData);
    }

    return html`
      <ha-card>
        <div class="card-content">
          ${this._renderHeader(entities, isCharging)}
          ${this._renderMainStatus(isCharging, chargingPower, sessionType)}
          ${this._renderControls(entities, isCharging, sessionType, currentLimit, currentRequest)}
          ${this.config.show_statistics ? this._renderStatistics(sessionDuration, sessionEnergy, entities) : ''}
          ${this.config.show_advanced ? this._renderAdvanced(entities, chargingCurrent) : ''}
        </div>
      </ha-card>
    `;
  }

  _getStatusInfo(entities, isCharging) {
    const chargerState = this._getEntityState(entities, 'charger_state', 'unknown');
    const hasValidData = this._hasValidData(entities);
    let statusClass, statusText;

    if (!hasValidData || chargerState.toLowerCase() === 'unknown') {
      statusClass = 'disconnected';
      statusText = 'Disconnected';
    } else if (chargerState.toLowerCase() === 'boot') {
      statusClass = 'booting';
      statusText = 'Booting';
    } else if (chargerState.toLowerCase() === 'initiated') {
      statusClass = 'initiating';
      statusText = 'Starting';
    } else if (chargerState.toLowerCase() === 'fatal error') {
      statusClass = 'error';
      statusText = 'Error';
    } else if (isCharging) {
      statusClass = 'charging';
      statusText = 'Charging';
    } else {
      statusClass = 'idle';
      statusText = 'Ready';
    }
    return { statusClass, statusText };
  }

  _renderHeader(entities, isCharging) {
    const chargerName = this._getChargerName();
    const { statusClass, statusText } = this._getStatusInfo(entities, isCharging);

    return html`
      <div class="header">
        <div class="header-left">
          <img src="${_hcBasePath}/assets/logo-color.png" class="header-logo header-logo-light" alt="HeyCharge" />
          <img src="${_hcBasePath}/assets/logo-dark.png" class="header-logo header-logo-dark" alt="HeyCharge" />
          <div class="device-name">${chargerName}</div>
        </div>
        <div class="status-pill ${statusClass}">
          <div class="status-dot"></div>
          <span>${statusText}</span>
        </div>
      </div>
    `;
  }

  _renderMainStatus(isCharging, chargingPower, sessionType) {
    const powerKw = (chargingPower / 1000).toFixed(1);
    const totalAmps = (chargingPower / 230).toFixed(1);
    const sessionBadge = this._getSessionBadge(sessionType);

    return html`
      <div class="main-status ${isCharging ? 'active' : ''}">
        <div class="power-display">
          <span class="power-value">${powerKw}</span>
          <span class="power-unit">kW</span>
          <span class="power-sep">|</span>
          <span class="power-amps">${totalAmps}</span>
          <span class="power-amps-unit">A</span>
        </div>
        <div class="power-label">Charging Power</div>
        ${sessionBadge}
      </div>
    `;
  }

  _renderControls(entities, isCharging, sessionType, currentLimit, currentRequest) {
    const showCompanyMode = this.config.show_company_mode && this._hasCompanyMode(entities);
    const sessionActive = this._getEntityState(entities, 'session_active', 'off') === 'on';
    const pauseCharging = this._getPauseCharging(entities);
    const chargerState = this._getEntityState(entities, 'charger_state', 'unknown');
    const isBooting = chargerState.toLowerCase() === 'boot';
    const controlsDisabled = isBooting || !this._hasValidData(entities);

    const displayedLimit = this._latchedValue !== null ? this._latchedValue : currentLimit;
    const sliderDisplay = this._isSliding && this._slidingValue !== null ? this._slidingValue : displayedLimit;

    const minLimit = 6;
    let maxLimit = 32;
    if (currentRequest >= 6 && currentRequest <= 32) {
      maxLimit = currentRequest;
    }

    let ticks = [];
    if (maxLimit <= 10) {
      ticks = [6, 8, maxLimit];
    } else if (maxLimit <= 16) {
      ticks = [6, 8, 12, maxLimit];
    } else if (maxLimit <= 24) {
      ticks = [6, 8, 16, maxLimit];
    } else {
      ticks = [6, 8, 16, 24, maxLimit];
    }
    ticks = [...new Set(ticks)].sort((a, b) => a - b);

    return html`
      <div class="controls">
        <div class="control-buttons">
          ${sessionActive ? html`
            <button class="control-button stop"
                    @click="${this._stopSession}"
                    ?disabled="${controlsDisabled || this._pendingSessionAction === 'stop'}">
              ${this._pendingSessionAction === 'stop' ? html`
                <ha-icon icon="mdi:loading" class="spinning"></ha-icon>
              ` : html`
                <ha-icon icon="mdi:stop-circle"></ha-icon>
              `}
              ${this._pendingSessionAction === 'stop' ? 'Stopping...' : 'End Session'}
            </button>
          ` : html`
            <button class="control-button start personal"
                    @click="${() => this._startSession('personal')}"
                    ?disabled="${controlsDisabled || this._pendingSessionAction === 'start'}">
              ${this._pendingSessionAction === 'start' ? html`
                <ha-icon icon="mdi:loading" class="spinning"></ha-icon>
              ` : html`
                <ha-icon icon="mdi:play-circle"></ha-icon>
              `}
              ${this._pendingSessionAction === 'start' ? 'Starting...' : (showCompanyMode ? 'Start Personal' : 'Start Charging')}
            </button>
            ${showCompanyMode ? html`
              <button class="control-button start company"
                      @click="${() => this._startSession('company')}"
                      ?disabled="${controlsDisabled || this._pendingSessionAction === 'start'}">
                ${this._pendingSessionAction === 'start' ? html`
                  <ha-icon icon="mdi:loading" class="spinning"></ha-icon>
                ` : html`
                  <ha-icon icon="mdi:play-circle-outline"></ha-icon>
                `}
                ${this._pendingSessionAction === 'start' ? 'Starting...' : 'Start Company'}
              </button>
            ` : ''}
          `}
        </div>

        <div class="pause-control">
          <div class="pause-label">
            <ha-icon icon="mdi:pause-circle"></ha-icon>
            <span>Pause Charging</span>
          </div>
          <ha-switch
            .checked="${pauseCharging}"
            .disabled="${controlsDisabled}"
            @change="${(e) => this._setPauseCharging(e.target.checked)}"
          ></ha-switch>
        </div>

        <div class="sliders">
          <div class="slider-control">
            <div class="slider-label">Current Limit</div>
            <div class="slider-container">
              <div class="slider-wrapper">
                <div class="slider-track">
                  <div class="slider-fill" style="width: ${((sliderDisplay - minLimit) / (maxLimit - minLimit)) * 100}%"></div>
                  ${currentRequest > 0 && isCharging ? html`
                    <div class="slider-request-marker" style="left: ${((currentRequest - minLimit) / (maxLimit - minLimit)) * 100}%">
                      <div class="request-line"></div>
                      <div class="request-label">Request</div>
                    </div>
                  ` : ''}
                </div>
                <div class="slider-ticks">
                  ${ticks.map(tick => html`
                    <div class="tick" style="left: ${((tick - minLimit) / (maxLimit - minLimit)) * 100}%">
                      <div class="tick-mark"></div>
                      <div class="tick-label">${tick}</div>
                    </div>
                  `)}
                </div>
                <input type="range" min="${minLimit}" max="${maxLimit}" step="1"
                       .value="${Math.min(maxLimit, Math.max(minLimit, displayedLimit))}"
                       ?disabled="${controlsDisabled}"
                       @input="${(e) => this._onSliderInput(e.target.value)}"
                       @change="${(e) => this._onSliderChange(e.target.value)}"
                       @mousedown="${() => this._onSliderStart()}"
                       @touchstart="${() => this._onSliderStart()}"
                       class="slider">
              </div>
              <div class="slider-value">${sliderDisplay} A</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _renderStatistics(sessionDuration, sessionEnergy, entities) {
    const lastSessionEnergy = this._getLastSessionEnergy(entities);
    const lastSessionDuration = this._getLastSessionDuration(entities);
    const isCharging = this._isCharging(entities);
    const currentRequest = this._getCurrentRequest(entities);

    return html`
      <div class="statistics">
        <div class="stat-row">
          ${isCharging ? html`
            <div class="stat-item">
              <ha-icon icon="mdi:timer"></ha-icon>
              <div class="stat-content">
                <div class="stat-value">${this._formatDuration(sessionDuration)}</div>
                <div class="stat-label">Session</div>
              </div>
            </div>
            <div class="stat-item">
              <ha-icon icon="mdi:lightning-bolt"></ha-icon>
              <div class="stat-content">
                <div class="stat-value">${sessionEnergy.toFixed(2)} kWh</div>
                <div class="stat-label">Energy</div>
              </div>
            </div>
            ${currentRequest > 0 ? html`
              <div class="stat-item">
                <ha-icon icon="mdi:car-electric"></ha-icon>
                <div class="stat-content">
                  <div class="stat-value">${currentRequest.toFixed(1)} A</div>
                  <div class="stat-label">Requested</div>
                </div>
              </div>
            ` : ''}
          ` : ''}
          <div class="stat-item">
            <ha-icon icon="mdi:history"></ha-icon>
            <div class="stat-content">
              <div class="stat-value">${lastSessionEnergy.toFixed(2)} kWh</div>
              <div class="stat-label">Last Energy</div>
            </div>
          </div>
          <div class="stat-item">
            <ha-icon icon="mdi:timer-outline"></ha-icon>
            <div class="stat-content">
              <div class="stat-value">${this._formatDuration(lastSessionDuration)}</div>
              <div class="stat-label">Last Duration</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _renderAdvanced(entities, chargingCurrent) {
    const chargerState = this._getChargerState(entities);
    const currentL1 = this._getCurrentL1(entities);
    const currentL2 = this._getCurrentL2(entities);
    const currentL3 = this._getCurrentL3(entities);

    return html`
      <div class="advanced">
        <div class="advanced-header" @click="${() => this._expanded = !this._expanded}">
          <span>Advanced</span>
          <ha-icon icon="${this._expanded ? 'mdi:chevron-up' : 'mdi:chevron-down'}"></ha-icon>
        </div>
        ${this._expanded ? html`
          <div class="advanced-content">
            <div class="advanced-item">
              <span>Charger State</span>
              <span class="advanced-value">${chargerState}</span>
            </div>
            <div class="advanced-item">
              <span>Current L1</span>
              <span class="advanced-value">${currentL1.toFixed(1)} A</span>
            </div>
            <div class="advanced-item">
              <span>Current L2</span>
              <span class="advanced-value">${currentL2.toFixed(1)} A</span>
            </div>
            <div class="advanced-item">
              <span>Current L3</span>
              <span class="advanced-value">${currentL3.toFixed(1)} A</span>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  _renderCompact(entities, isCharging, chargingPower, currentLimit, currentRequest, sessionActive, chargerState, hasValidData) {
    const chargerName = this._getChargerName();
    const powerKw = (chargingPower / 1000).toFixed(1);
    const isBooting = chargerState.toLowerCase() === 'boot';
    const controlsDisabled = isBooting || !hasValidData;
    const { statusClass } = this._getStatusInfo(entities, isCharging);
    const displayedLimit = this._latchedValue !== null ? this._latchedValue : currentLimit;

    return html`
      <ha-card class="compact">
        <div class="compact-row">
          <div class="compact-status ${statusClass}">
            <div class="compact-dot"></div>
          </div>
          <div class="compact-name">${chargerName}</div>
          <div class="compact-power ${isCharging ? 'active' : ''}">
            ${powerKw} <span class="compact-unit">kW</span>
          </div>
          <div class="compact-limit">
            <button class="compact-limit-btn"
                    @click="${() => this._adjustLimit(-1, entities)}"
                    ?disabled="${controlsDisabled}">
              <ha-icon icon="mdi:minus"></ha-icon>
            </button>
            <span class="compact-limit-value">${displayedLimit}A</span>
            <button class="compact-limit-btn"
                    @click="${() => this._adjustLimit(1, entities)}"
                    ?disabled="${controlsDisabled}">
              <ha-icon icon="mdi:plus"></ha-icon>
            </button>
          </div>
          <div class="compact-action">
            ${sessionActive ? html`
              <button class="compact-btn stop"
                      @click="${this._stopSession}"
                      ?disabled="${controlsDisabled || this._pendingSessionAction === 'stop'}">
                ${this._pendingSessionAction === 'stop' ? html`
                  <ha-icon icon="mdi:loading" class="spinning"></ha-icon>
                ` : html`
                  <ha-icon icon="mdi:stop"></ha-icon>
                `}
              </button>
            ` : html`
              <button class="compact-btn start"
                      @click="${() => this._startSession('personal')}"
                      ?disabled="${controlsDisabled || this._pendingSessionAction === 'start'}">
                ${this._pendingSessionAction === 'start' ? html`
                  <ha-icon icon="mdi:loading" class="spinning"></ha-icon>
                ` : html`
                  <ha-icon icon="mdi:play"></ha-icon>
                `}
              </button>
            `}
          </div>
        </div>
      </ha-card>
    `;
  }

  _getSessionBadge(sessionType) {
    if (sessionType === 'none' || !sessionType) return '';
    const isPersonal = sessionType === 'personal';
    const icon = isPersonal ? 'mdi:account' : 'mdi:domain';
    const label = isPersonal ? 'Personal' : 'Company';
    const className = isPersonal ? 'personal' : 'company';

    return html`
      <div class="session-badge ${className}">
        <ha-icon icon="${icon}"></ha-icon>
        <span>${label}</span>
      </div>
    `;
  }

  // Entity helper methods

  // Known entity suffixes — used to auto-detect entities from any source
  // (MQTT discovery, custom component, or manual entity naming)
  static get ENTITY_SUFFIXES() {
    return {
      pause_charging:     { domain: 'switch',        suffix: 'pause_charging' },
      charging_current_l1:{ domain: 'sensor',        suffix: 'charging_current_l1' },
      charging_current_l2:{ domain: 'sensor',        suffix: 'charging_current_l2' },
      charging_current_l3:{ domain: 'sensor',        suffix: 'charging_current_l3' },
      charging_power:     { domain: 'sensor',        suffix: 'charging_power' },
      charger_state:      { domain: 'sensor',        suffix: 'charger_state' },
      current_limit:      { domain: 'number',        suffix: 'charging_current_limit' },
      current_request:    { domain: 'sensor',        suffix: 'current_request' },
      kwh_delivered:      { domain: 'sensor',        suffix: 'kwh_delivered' },
      session_duration:   { domain: 'sensor',        suffix: 'current_session_duration' },
      last_session_energy:{ domain: 'sensor',        suffix: 'last_session_energy' },
      last_session_duration:{ domain: 'sensor',      suffix: 'last_session_duration' },
      session_active:     { domain: 'binary_sensor', suffix: 'session_active' },
      session_type:       { domain: 'sensor',        suffix: 'session_type' },
      start_personal:     { domain: 'button',        suffix: 'start_session_personal' },
      start_company:      { domain: 'button',        suffix: 'start_session_company' },
      end_session:        { domain: 'button',        suffix: 'end_session' },
    };
  }

  _getDeviceId() {
    if (this.config.device_id) return this.config.device_id;
    const prefix = this.config.entity_prefix || 'sensor.heycharge_';
    const entities = Object.keys(this.hass.states).filter(e => e.startsWith(prefix));
    if (entities.length > 0) {
      const match = entities[0].match(/heycharge_([^_]+)/);
      return match ? match[1] : null;
    }
    return null;
  }

  _getEntities(deviceId) {
    // Cache scan results for 10 seconds to avoid re-scanning every render
    const now = Date.now();
    if (this._cachedEntities && (now - this._cachedEntitiesTime) < 10000) {
      return this._cachedEntities;
    }

    // Try suffix-based scan first — works with any entity naming pattern
    const scanned = this._scanEntities();
    if (scanned) {
      this._cachedEntities = scanned;
      this._cachedEntitiesTime = now;
      return scanned;
    }

    // Fallback: construct from device_id (MQTT discovery pattern)
    const base = deviceId ? `heycharge_${deviceId}` : 'heycharge';
    const result = {};
    for (const [key, info] of Object.entries(HeyChargeCard.ENTITY_SUFFIXES)) {
      result[key] = `${info.domain}.${base}_${info.suffix}`;
    }
    return result;
  }

  _scanEntities() {
    const allStates = Object.keys(this.hass.states);
    const hcEntities = allStates.filter(e => e.includes('heycharge'));
    if (hcEntities.length === 0) return null;

    const result = {};
    let matchCount = 0;

    for (const [key, info] of Object.entries(HeyChargeCard.ENTITY_SUFFIXES)) {
      const match = hcEntities.find(e =>
        e.startsWith(info.domain + '.') && e.endsWith('_' + info.suffix)
      );
      if (match) {
        result[key] = match;
        matchCount++;
      }
    }

    // Need at least a few core entities to consider this a valid match
    if (matchCount < 3) return null;

    // Fill missing keys with empty string so _getEntityState returns defaults
    for (const key of Object.keys(HeyChargeCard.ENTITY_SUFFIXES)) {
      if (!result[key]) result[key] = '';
    }

    return result;
  }

  _getEntityState(entities, key, defaultValue = 0) {
    const entityId = entities[key];
    if (!entityId) return defaultValue;
    const entity = this.hass.states[entityId];
    return entity ? entity.state : defaultValue;
  }

  _getEntityNumericState(entities, key, defaultValue = 0) {
    const state = this._getEntityState(entities, key, defaultValue);
    return parseFloat(state) || defaultValue;
  }

  _isCharging(entities) {
    const chargerState = this._getEntityState(entities, 'charger_state', 'Unknown');
    const chargingPower = this._getEntityNumericState(entities, 'charging_power', 0);
    return chargerState.toLowerCase() === 'charging' || chargingPower > 100;
  }

  _hasValidData(entities) {
    const STALE_TIMEOUT = 60000;
    const now = new Date();
    for (const entityKey of Object.keys(entities)) {
      const entity = this.hass.states[entities[entityKey]];
      if (entity && entity.state !== 'unavailable') {
        const lastChanged = new Date(entity.last_changed);
        if (now - lastChanged < STALE_TIMEOUT) return true;
      }
    }
    return false;
  }

  _getSessionType(entities) { return this._getEntityState(entities, 'session_type', 'none'); }
  _getChargingPower(entities) { return this._getEntityNumericState(entities, 'charging_power', 0); }
  _getMaxChargingCurrent(entities) {
    return Math.max(this._getCurrentL1(entities), this._getCurrentL2(entities), this._getCurrentL3(entities));
  }
  _getCurrentLimit(entities) { return this._getEntityNumericState(entities, 'current_limit', 16); }
  _getCurrentRequest(entities) { return this._getEntityNumericState(entities, 'current_request', 0); }
  _getChargerState(entities) { return this._getEntityState(entities, 'charger_state', 'Unknown'); }
  _getCurrentL1(entities) { return this._getEntityNumericState(entities, 'charging_current_l1', 0); }
  _getCurrentL2(entities) { return this._getEntityNumericState(entities, 'charging_current_l2', 0); }
  _getCurrentL3(entities) { return this._getEntityNumericState(entities, 'charging_current_l3', 0); }
  _getSessionDuration(entities) { return this._getEntityNumericState(entities, 'session_duration', 0); }
  _getSessionEnergy(entities) { return this._getEntityNumericState(entities, 'kwh_delivered', 0); }
  _getLastSessionEnergy(entities) { return this._getEntityNumericState(entities, 'last_session_energy', 0); }
  _getLastSessionDuration(entities) { return this._getEntityNumericState(entities, 'last_session_duration', 0); }
  _getPauseCharging(entities) { return this._getEntityState(entities, 'pause_charging', 'off') === 'on'; }
  _hasCompanyMode(entities) { return entities.start_company && this.hass.states[entities.start_company] !== undefined; }

  _getChargerName() {
    if (this.config.charger_name) return this.config.charger_name;
    const deviceId = this._getDeviceId();
    const entities = this._getEntities(deviceId);
    for (const key in entities) {
      if (!entities[key]) continue;
      const entity = this.hass.states[entities[key]];
      if (entity && entity.attributes) {
        if (entity.attributes.device && entity.attributes.device.name) {
          return entity.attributes.device.name;
        }
        if (entity.attributes.friendly_name) {
          const name = entity.attributes.friendly_name.replace(/ (Charging Power|Charger State|Session Active)$/i, '');
          if (name && name !== entity.attributes.friendly_name) return name;
        }
      }
    }
    return 'HeyCharge';
  }

  _formatDuration(seconds) {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }

  // Control methods
  _startSession(type) {
    const deviceId = this._getDeviceId();
    const entities = this._getEntities(deviceId);
    const button = type === 'company' ? entities.start_company : entities.start_personal;
    this._pendingSessionAction = 'start';
    this._clearSessionActionTimeout();
    this._sessionActionTimeout = setTimeout(() => {
      this._pendingSessionAction = null;
      this.requestUpdate();
    }, 10000);
    this.hass.callService('button', 'press', { entity_id: button });
  }

  _stopSession() {
    const deviceId = this._getDeviceId();
    const entities = this._getEntities(deviceId);
    this._pendingSessionAction = 'stop';
    this._clearSessionActionTimeout();
    this._sessionActionTimeout = setTimeout(() => {
      this._pendingSessionAction = null;
      this.requestUpdate();
    }, 10000);
    this.hass.callService('button', 'press', { entity_id: entities.end_session });
  }

  _checkSessionStateChange(sessionActive) {
    if (this._previousSessionActive !== null && this._previousSessionActive !== sessionActive) {
      if (this._pendingSessionAction) {
        this._pendingSessionAction = null;
        this._clearSessionActionTimeout();
      }
    }
    this._previousSessionActive = sessionActive;
  }

  _clearSessionActionTimeout() {
    if (this._sessionActionTimeout) {
      clearTimeout(this._sessionActionTimeout);
      this._sessionActionTimeout = null;
    }
  }

  _setCurrentLimit(value) {
    const deviceId = this._getDeviceId();
    const entities = this._getEntities(deviceId);
    this.hass.callService('number', 'set_value', {
      entity_id: entities.current_limit,
      value: parseFloat(value),
    });
  }

  _adjustLimit(delta, entities) {
    const currentLimit = this._getCurrentLimit(entities);
    const currentRequest = this._getCurrentRequest(entities);
    const minLimit = 6;
    const maxLimit = (currentRequest >= 6 && currentRequest <= 32) ? currentRequest : 32;
    const newValue = Math.min(maxLimit, Math.max(minLimit, currentLimit + delta));
    this._latchedValue = newValue;
    if (this._latchTimeout) clearTimeout(this._latchTimeout);
    this._latchTimeout = setTimeout(() => {
      this._latchedValue = null;
      this.requestUpdate();
    }, 5000);
    this._setCurrentLimit(newValue);
  }

  _onSliderStart() { this._isSliding = true; }

  _onSliderInput(value) {
    this._slidingValue = parseInt(value);
    this._isSliding = true;
  }

  _onSliderChange(value) {
    const intValue = parseInt(value);
    this._latchedValue = intValue;
    this._slidingValue = intValue;
    this._isSliding = false;
    if (this._latchTimeout) clearTimeout(this._latchTimeout);
    this._latchTimeout = setTimeout(() => {
      this._latchedValue = null;
      this._slidingValue = null;
      this.requestUpdate();
    }, 5000);
    this._setCurrentLimit(intValue);
  }

  _setPauseCharging(paused) {
    const deviceId = this._getDeviceId();
    const entities = this._getEntities(deviceId);
    this.hass.callService('switch', paused ? 'turn_on' : 'turn_off', {
      entity_id: entities.pause_charging,
    });
  }

  static get styles() {
    return css`
      /* ===== Design Tokens ===== */
      :host {
        --hc-accent: var(--primary-color, #00C853);
        --hc-accent-rgb: var(--rgb-primary-color, 0, 200, 83);
        --hc-bg: var(--ha-card-background, var(--card-background-color, #fff));
        --hc-bg-secondary: var(--secondary-background-color, rgba(127, 127, 127, 0.06));
        --hc-text: var(--primary-text-color, #212121);
        --hc-text-secondary: var(--secondary-text-color, #727272);
        --hc-divider: var(--divider-color, rgba(127, 127, 127, 0.12));
        --hc-active: var(--state-active-color, #4CAF50);
        --hc-error: var(--error-color, #F44336);
        --hc-error-rgb: var(--rgb-error-color, 244, 67, 54);
        --hc-warning: var(--warning-color, #FF9800);
        --hc-info: var(--info-color, #2196F3);
        --hc-info-rgb: var(--rgb-info-color, 33, 150, 243);
        --hc-company: var(--accent-color, #7E57C2);
        --hc-company-rgb: var(--rgb-accent-color, 126, 87, 194);
        --hc-radius: var(--ha-card-border-radius, 12px);
        --hc-pill: 200px;
        --hc-transition: 0.3s ease-in-out;
      }

      /* ===== Card Shell ===== */
      ha-card {
        overflow: hidden;
        border-radius: var(--hc-radius);
        background: var(--hc-bg);
        backdrop-filter: var(--ha-card-backdrop-filter, none);
        box-shadow: var(--ha-card-box-shadow, none);
      }

      .card-content {
        padding: 0;
      }

      /* ===== Header ===== */
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
      }

      .header-left {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }

      .header-logo {
        height: 28px;
        width: auto;
        object-fit: contain;
        flex-shrink: 0;
      }

      .header-logo-dark {
        display: none;
      }

      @media (prefers-color-scheme: dark) {
        .header-logo-light { display: none; }
        .header-logo-dark { display: block; }
      }


      .device-name {
        font-size: 14px;
        font-weight: 600;
        color: var(--hc-text);
        line-height: 1.3;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* Status Pill */
      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: var(--hc-pill);
        font-size: 12px;
        font-weight: 500;
        background: var(--hc-bg-secondary);
        color: var(--hc-text-secondary);
        transition: all var(--hc-transition);
        flex-shrink: 0;
      }

      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--hc-text-secondary);
        transition: all var(--hc-transition);
        flex-shrink: 0;
      }

      .status-pill.charging {
        background: rgba(var(--hc-accent-rgb), 0.12);
        color: var(--hc-accent);
      }
      .status-pill.charging .status-dot {
        background: var(--hc-accent);
        animation: pulse 2s infinite;
      }

      .status-pill.idle .status-dot {
        background: var(--hc-active);
      }

      .status-pill.disconnected {
        background: rgba(var(--hc-error-rgb), 0.1);
        color: var(--hc-error);
      }
      .status-pill.disconnected .status-dot {
        background: var(--hc-error);
      }

      .status-pill.booting,
      .status-pill.initiating {
        background: rgba(255, 152, 0, 0.1);
        color: var(--hc-warning);
      }
      .status-pill.booting .status-dot,
      .status-pill.initiating .status-dot {
        background: var(--hc-warning);
        animation: pulse 1.5s infinite;
      }

      .status-pill.error {
        background: rgba(var(--hc-error-rgb), 0.1);
        color: var(--hc-error);
      }
      .status-pill.error .status-dot {
        background: var(--hc-error);
      }

      /* ===== Animations ===== */
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.35; }
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      @keyframes slideDown {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .spinning {
        animation: spin 1s linear infinite;
      }

      /* ===== Main Status ===== */
      .main-status {
        padding: 20px 16px;
        text-align: center;
        transition: background-color var(--hc-transition);
      }

      .main-status.active {
        background: rgba(var(--hc-accent-rgb), 0.06);
      }

      .power-display {
        display: flex;
        align-items: baseline;
        justify-content: center;
        gap: 4px;
      }

      .power-value {
        font-size: 32px;
        font-weight: 600;
        color: var(--hc-text);
        line-height: 1;
        transition: color var(--hc-transition);
      }

      .main-status.active .power-value {
        color: var(--hc-accent);
      }

      .power-unit {
        font-size: 16px;
        font-weight: 400;
        color: var(--hc-text-secondary);
      }

      .power-sep {
        font-size: 16px;
        color: var(--hc-divider);
        margin: 0 6px;
      }

      .power-amps {
        font-size: 20px;
        font-weight: 500;
        color: var(--hc-text-secondary);
      }

      .power-amps-unit {
        font-size: 14px;
        color: var(--hc-text-secondary);
      }

      .power-label {
        font-size: 12px;
        color: var(--hc-text-secondary);
        margin-top: 4px;
        opacity: 0.6;
      }

      /* Session Badge */
      .session-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: var(--hc-pill);
        margin-top: 8px;
        font-size: 12px;
        font-weight: 500;
      }

      .session-badge ha-icon {
        --mdc-icon-size: 14px;
      }

      .session-badge.personal {
        background: rgba(var(--hc-info-rgb), 0.12);
        color: var(--hc-info);
      }

      .session-badge.company {
        background: rgba(var(--hc-company-rgb), 0.12);
        color: var(--hc-company);
      }

      /* ===== Controls ===== */
      .controls {
        padding: 16px;
        border-top: 1px solid var(--hc-divider);
      }

      .control-buttons {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
      }

      .control-button {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px 16px;
        border: none;
        border-radius: var(--hc-pill);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all var(--hc-transition);
        -webkit-tap-highlight-color: transparent;
      }

      .control-button ha-icon {
        --mdc-icon-size: 18px;
      }

      .control-button.start.personal {
        background: rgba(var(--hc-info-rgb), 0.12);
        color: var(--hc-info);
      }
      .control-button.start.personal:hover:not([disabled]) {
        background: rgba(var(--hc-info-rgb), 0.22);
      }

      .control-button.start.company {
        background: rgba(var(--hc-company-rgb), 0.12);
        color: var(--hc-company);
      }
      .control-button.start.company:hover:not([disabled]) {
        background: rgba(var(--hc-company-rgb), 0.22);
      }

      .control-button.stop {
        background: rgba(var(--hc-error-rgb), 0.12);
        color: var(--hc-error);
      }
      .control-button.stop:hover:not([disabled]) {
        background: rgba(var(--hc-error-rgb), 0.22);
      }

      .control-button:active:not([disabled]) {
        transform: scale(0.98);
      }

      .control-button[disabled] {
        opacity: 0.3;
        cursor: not-allowed;
      }

      /* Pause Control */
      .pause-control {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 0;
        margin-bottom: 8px;
      }

      .pause-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 500;
        color: var(--hc-text);
      }

      .pause-label ha-icon {
        color: var(--hc-text-secondary);
        --mdc-icon-size: 18px;
        opacity: 0.6;
      }

      /* ===== Slider ===== */
      .sliders {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .slider-control {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .slider-label {
        font-size: 12px;
        font-weight: 500;
        color: var(--hc-text-secondary);
        opacity: 0.7;
      }

      .slider-container {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 18px;
      }

      .slider-wrapper {
        position: relative;
        flex: 1;
        height: 36px;
        display: flex;
        align-items: center;
      }

      .slider-track {
        position: absolute;
        width: 100%;
        height: 4px;
        background: var(--hc-divider);
        border-radius: 2px;
        overflow: visible;
      }

      .slider-fill {
        position: absolute;
        height: 100%;
        background: var(--hc-accent);
        border-radius: 2px;
        transition: width 0.2s ease;
        opacity: 0.7;
      }

      .slider {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 4px;
        background: transparent;
        outline: none;
        position: relative;
        z-index: 2;
      }

      .slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--hc-accent);
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        border: 2px solid var(--hc-bg);
      }

      .slider::-webkit-slider-thumb:hover {
        transform: scale(1.15);
        box-shadow: 0 2px 8px rgba(var(--hc-accent-rgb), 0.35);
      }

      .slider::-webkit-slider-thumb:active {
        transform: scale(1.05);
      }

      .slider::-moz-range-thumb {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--hc-accent);
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        border: 2px solid var(--hc-bg);
      }

      .slider-value {
        font-size: 16px;
        font-weight: 600;
        color: var(--hc-accent);
        min-width: 48px;
        text-align: right;
      }

      /* Tick Marks */
      .slider-ticks {
        position: absolute;
        width: 100%;
        height: 24px;
        top: 100%;
        margin-top: 2px;
        pointer-events: none;
      }

      .tick {
        position: absolute;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .tick-mark {
        width: 1px;
        height: 4px;
        background: var(--hc-text-secondary);
        opacity: 0.25;
      }

      .tick-label {
        font-size: 9px;
        color: var(--hc-text-secondary);
        margin-top: 2px;
        opacity: 0.4;
      }

      /* Request Marker */
      .slider-request-marker {
        position: absolute;
        top: -6px;
        bottom: -6px;
        transform: translateX(-50%);
        pointer-events: none;
        z-index: 1;
      }

      .request-line {
        position: absolute;
        width: 2px;
        height: 16px;
        background: var(--hc-warning);
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        opacity: 0.7;
        border-radius: 1px;
      }

      .request-label {
        position: absolute;
        top: -16px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 9px;
        color: var(--hc-warning);
        font-weight: 600;
        white-space: nowrap;
        opacity: 0.7;
      }

      /* ===== Statistics ===== */
      .statistics {
        padding: 12px 16px;
        border-top: 1px solid var(--hc-divider);
      }

      .stat-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .stat-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: var(--hc-bg-secondary);
        border-radius: 28px;
        flex: 1;
        min-width: 0;
      }

      .stat-item ha-icon {
        color: var(--hc-accent);
        --mdc-icon-size: 16px;
        flex-shrink: 0;
        opacity: 0.7;
      }

      .stat-content {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .stat-value {
        font-size: 13px;
        font-weight: 600;
        color: var(--hc-text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        line-height: 1.3;
      }

      .stat-label {
        font-size: 10px;
        color: var(--hc-text-secondary);
        opacity: 0.7;
      }

      /* ===== Advanced ===== */
      .advanced {
        border-top: 1px solid var(--hc-divider);
      }

      .advanced-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        color: var(--hc-text-secondary);
        opacity: 0.6;
        transition: opacity 0.2s ease;
      }

      .advanced-header:hover {
        opacity: 1;
      }

      .advanced-header ha-icon {
        --mdc-icon-size: 18px;
        transition: transform 0.3s ease;
      }

      .advanced-content {
        padding: 0 16px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        animation: slideDown 0.2s ease-in-out;
      }

      .advanced-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;
        padding: 4px 0;
        color: var(--hc-text);
      }

      .advanced-value {
        font-weight: 600;
        color: var(--hc-accent);
        font-size: 12px;
      }

      /* ===== Compact Mode ===== */
      ha-card.compact {
        overflow: hidden;
      }

      .compact-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        min-height: 56px;
        box-sizing: border-box;
      }

      .compact-status { flex-shrink: 0; }

      .compact-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--hc-text-secondary);
        transition: all var(--hc-transition);
      }

      .compact-status.charging .compact-dot {
        background: var(--hc-accent);
        animation: pulse 2s infinite;
      }
      .compact-status.idle .compact-dot { background: var(--hc-active); }
      .compact-status.disconnected .compact-dot { background: var(--hc-error); }
      .compact-status.booting .compact-dot,
      .compact-status.initiating .compact-dot {
        background: var(--hc-warning);
        animation: pulse 1.5s infinite;
      }
      .compact-status.error .compact-dot { background: var(--hc-error); }

      .compact-name {
        font-size: 13px;
        font-weight: 600;
        color: var(--hc-text);
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .compact-power {
        font-size: 16px;
        font-weight: 600;
        color: var(--hc-text-secondary);
        flex-shrink: 0;
        transition: color var(--hc-transition);
      }

      .compact-power.active { color: var(--hc-accent); }

      .compact-unit {
        font-size: 11px;
        font-weight: 400;
        opacity: 0.7;
      }

      .compact-limit {
        display: flex;
        align-items: center;
        gap: 2px;
        flex-shrink: 0;
      }

      .compact-limit-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border: none;
        border-radius: 50%;
        background: var(--hc-bg-secondary);
        color: var(--hc-text-secondary);
        cursor: pointer;
        transition: all var(--hc-transition);
        padding: 0;
        -webkit-tap-highlight-color: transparent;
      }

      .compact-limit-btn:hover:not([disabled]) {
        background: rgba(var(--hc-accent-rgb), 0.12);
        color: var(--hc-accent);
      }

      .compact-limit-btn:active:not([disabled]) {
        transform: scale(0.9);
      }

      .compact-limit-btn[disabled] {
        opacity: 0.3;
        cursor: not-allowed;
      }

      .compact-limit-btn ha-icon {
        --mdc-icon-size: 14px;
      }

      .compact-limit-value {
        font-size: 13px;
        font-weight: 600;
        color: var(--hc-accent);
        min-width: 28px;
        text-align: center;
      }

      .compact-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        transition: all var(--hc-transition);
        flex-shrink: 0;
        padding: 0;
        -webkit-tap-highlight-color: transparent;
      }

      .compact-btn.start {
        background: rgba(var(--hc-info-rgb), 0.12);
        color: var(--hc-info);
      }
      .compact-btn.start:hover:not([disabled]) {
        background: rgba(var(--hc-info-rgb), 0.22);
      }

      .compact-btn.stop {
        background: rgba(var(--hc-error-rgb), 0.12);
        color: var(--hc-error);
      }
      .compact-btn.stop:hover:not([disabled]) {
        background: rgba(var(--hc-error-rgb), 0.22);
      }

      .compact-btn:active:not([disabled]) {
        transform: scale(0.9);
      }

      .compact-btn[disabled] {
        opacity: 0.3;
        cursor: not-allowed;
      }

      .compact-btn ha-icon {
        --mdc-icon-size: 18px;
      }

      /* ===== Responsive ===== */
      @media (max-width: 480px) {
        .power-value {
          font-size: 28px;
        }

        .stat-row {
          flex-direction: column;
        }

        .compact-row {
          gap: 8px;
          padding: 10px 12px;
        }

        .compact-name {
          font-size: 12px;
        }

        .compact-power {
          font-size: 14px;
        }
      }
    `;
  }
}

// Register the card
if (!customElements.get("heycharge-card")) {
  customElements.define("heycharge-card", HeyChargeCard);
  console.log("HeyCharge Card registered successfully");
} else {
  console.log("HeyCharge Card was already registered");
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "heycharge-card",
  name: "HeyCharge Card",
  description: "Control and monitor your HeyCharge EV charger",
  preview: true,
  documentationURL: "https://github.com/heycharge/heycharge-gateway-esp32/tree/main/homeassistant/card",
});

// Determine base path from current script URL (works with both /local/ and /hacsfiles/)
const _hcScripts = document.querySelectorAll('script[src*="heycharge-card"]');
const _hcBasePath = _hcScripts.length > 0
  ? _hcScripts[_hcScripts.length - 1].src.replace(/\/[^/]*$/, '')
  : '/local/heycharge-card';

// Load editor component
if (!customElements.get("heycharge-card-editor")) {
  const editorScript = document.createElement("script");
  editorScript.type = "module";
  editorScript.src = _hcBasePath + "/heycharge-card-editor.js?v=2";
  document.head.appendChild(editorScript);
}

console.log("HeyCharge Card v2.1 loaded");
