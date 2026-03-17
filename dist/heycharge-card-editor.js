const LitElement = Object.getPrototypeOf(
  customElements.get("ha-panel-lovelace")
);
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

const fireEvent = (node, type, detail, options) => {
  options = options || {};
  detail = detail === null || detail === undefined ? {} : detail;
  const event = new Event(type, {
    bubbles: options.bubbles === undefined ? true : options.bubbles,
    cancelable: Boolean(options.cancelable),
    composed: options.composed === undefined ? true : options.composed,
  });
  event.detail = detail;
  node.dispatchEvent(event);
  return event;
};

export class HeyChargeCardEditor extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      _config: { type: Object },
      _helpers: { type: Object },
    };
  }

  setConfig(config) {
    this._config = config;
    this._loadHelpers();
  }

  async _loadHelpers() {
    this._helpers = await window.loadCardHelpers?.() || {};
  }

  get _entity_prefix() {
    return this._config?.entity_prefix || "";
  }

  get _device_id() {
    return this._config?.device_id || "";
  }

  get _charger_name() {
    return this._config?.charger_name || "";
  }

  get _show_company_mode() {
    return this._config?.show_company_mode !== false;
  }

  get _show_statistics() {
    return this._config?.show_statistics !== false;
  }

  get _show_advanced() {
    return this._config?.show_advanced || false;
  }

  get _compact_mode() {
    return this._config?.compact_mode || false;
  }

  render() {
    if (!this.hass || !this._helpers) {
      return html``;
    }

    return html`
      <div class="card-config">
        <div class="config-section">
          <h3>Basic Configuration</h3>
          
          <paper-input
            label="Entity Prefix (optional)"
            .value="${this._entity_prefix}"
            .configValue="${"entity_prefix"}"
            @value-changed="${this._valueChanged}"
            placeholder="sensor.heycharge_"
          ></paper-input>
          
          <paper-input
            label="Device ID (optional)"
            .value="${this._device_id}"
            .configValue="${"device_id"}"
            @value-changed="${this._valueChanged}"
            placeholder="Auto-detected from entities"
          ></paper-input>
          
          <paper-input
            label="Charger Name (optional)"
            .value="${this._charger_name}"
            .configValue="${"charger_name"}"
            @value-changed="${this._valueChanged}"
            placeholder="HeyCharge Gateway"
          ></paper-input>
        </div>

        <div class="config-section">
          <h3>Display Options</h3>
          
          <ha-formfield label="Show Company Mode Features">
            <ha-switch
              .checked="${this._show_company_mode}"
              .configValue="${"show_company_mode"}"
              @change="${this._valueChanged}"
            ></ha-switch>
          </ha-formfield>
          
          <ha-formfield label="Show Statistics">
            <ha-switch
              .checked="${this._show_statistics}"
              .configValue="${"show_statistics"}"
              @change="${this._valueChanged}"
            ></ha-switch>
          </ha-formfield>
          
          <ha-formfield label="Show Advanced Settings">
            <ha-switch
              .checked="${this._show_advanced}"
              .configValue="${"show_advanced"}"
              @change="${this._valueChanged}"
            ></ha-switch>
          </ha-formfield>
          
          <ha-formfield label="Compact Mode">
            <ha-switch
              .checked="${this._compact_mode}"
              .configValue="${"compact_mode"}"
              @change="${this._valueChanged}"
            ></ha-switch>
          </ha-formfield>
        </div>

        <div class="config-section">
          <h3>Detected Entities</h3>
          <div class="entity-list">
            ${this._renderDetectedEntities()}
          </div>
        </div>

        <div class="info">
          <p>
            The card will automatically detect HeyCharge Consumer Gateway entities
            based on the entity prefix. If auto-detection doesn't work, you can
            manually specify the device ID.
          </p>
          <p>
            <strong>Company Mode:</strong> Enable to show separate controls for
            personal and company charging sessions.
          </p>
          <p>
            <strong>Compact Mode:</strong> Use for smaller dashboard cards with
            reduced information display.
          </p>
        </div>
      </div>
    `;
  }

  _renderDetectedEntities() {
    const allEntities = Object.keys(this.hass.states)
      .filter(e => e.includes("heycharge"));
    const displayed = allEntities.slice(0, 10);
    const remaining = allEntities.length - displayed.length;

    if (allEntities.length === 0) {
      return html`
        <div class="no-entities">
          No HeyCharge entities detected. Make sure your Consumer Gateway
          is connected to your network and entities are available via
          MQTT discovery or the HeyCharge custom component.
        </div>
      `;
    }

    return html`
      <div class="detected-entities">
        <p>Found ${allEntities.length} HeyCharge entities:</p>
        <ul>
          ${displayed.map(entity => html`
            <li>${entity}</li>
          `)}
        </ul>
        ${remaining > 0 ? html`<p>...and ${remaining} more</p>` : ''}
      </div>
    `;
  }

  _valueChanged(ev) {
    if (!this._config || !this.hass) {
      return;
    }

    const target = ev.target;
    const configValue = target.configValue;

    if (!configValue) {
      return;
    }

    let value;
    if (target.checked !== undefined) {
      value = target.checked;
    } else {
      value = target.value;
    }

    if (value === "") {
      const tmpConfig = { ...this._config };
      delete tmpConfig[configValue];
      this._config = tmpConfig;
    } else {
      this._config = {
        ...this._config,
        [configValue]: value,
      };
    }

    fireEvent(this, "config-changed", { config: this._config });
  }

  static get styles() {
    return css`
      .card-config {
        padding: 16px;
      }

      .config-section {
        margin-bottom: 24px;
      }

      .config-section h3 {
        margin: 0 0 16px 0;
        font-size: 16px;
        font-weight: 500;
        color: var(--primary-text-color);
      }

      paper-input {
        display: block;
        margin-bottom: 12px;
      }

      ha-formfield {
        display: block;
        margin-bottom: 12px;
        padding: 8px 0;
      }

      .entity-list {
        background: var(--secondary-background-color);
        border-radius: 8px;
        padding: 12px;
        margin-top: 8px;
      }

      .no-entities {
        color: var(--secondary-text-color);
        font-style: italic;
      }

      .detected-entities p {
        margin: 0 0 8px 0;
        font-weight: 500;
      }

      .detected-entities ul {
        margin: 0;
        padding-left: 20px;
        font-family: monospace;
        font-size: 12px;
        color: var(--secondary-text-color);
      }

      .detected-entities li {
        margin: 4px 0;
      }

      .info {
        margin-top: 24px;
        padding: 16px;
        background: var(--info-color, rgba(33, 150, 243, 0.1));
        border-radius: 8px;
        border-left: 4px solid var(--info-color, #2196F3);
      }

      .info p {
        margin: 0 0 12px 0;
        font-size: 14px;
        line-height: 1.5;
        color: var(--primary-text-color);
      }

      .info p:last-child {
        margin-bottom: 0;
      }

      .info strong {
        font-weight: 500;
      }
    `;
  }
}

customElements.define("heycharge-card-editor", HeyChargeCardEditor);