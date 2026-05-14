# HeyCharge Card

A Home Assistant Lovelace card for controlling and monitoring a [HeyCharge CONNECT](https://heycharge.com/) device — pairs with the [HeyCharge CONNECT integration](https://github.com/heycharge-hq/homeassistant-heycharge) and works with the [CONNECT Bridge](https://heycharge.com/products/connect-bridge) and [CONNECT MagicBox](https://heycharge.com/products/consumer-gateway).

## Features

- Real-time power, current, and energy monitoring with animated indicators
- Stop the current session, pause/resume, adjust current limit
- Current limit slider (6-32A) with live feedback
- Session statistics (energy, duration, current request)
- Per-phase current readings in advanced view
- Responsive layout for mobile, tablet, and desktop
- Automatic theme integration

## What's Displayed

### Main Status
- Charging power (kW) and current (A) while a session is active; idle indicator otherwise
- Status pill showing Ready / Charging / Error / etc.
- Small header LEDs for §14a curtailment and HeyCharge-backend status when configured

### Controls
- End session button (when a session is active)
- Pause charging switch
- Current limit slider (6-32A)

### Statistics
- Current session duration and energy
- Last session energy and duration
- Current request from the EV

### Advanced (Optional)
- Charger state details
- Per-phase current readings (L1, L2, L3)

## Configuration

The card automatically detects your HeyCharge entities:

```yaml
type: custom:heycharge-card
entity_prefix: sensor.heycharge_  # Optional: entity prefix for auto-discovery
device_id: ABCD                   # Optional: manually specify device ID
charger_name: My Charger          # Optional: custom display name
show_statistics: true             # Show energy statistics
show_advanced: false              # Show advanced details section
compact_mode: false               # Use compact layout
```

## Requirements

- Home Assistant 2023.1.0+
- [HeyCharge CONNECT integration](https://github.com/heycharge-hq/homeassistant-heycharge) installed and configured
- A [CONNECT Bridge](https://heycharge.com/products/connect-bridge) (OCPP Translator firmware) or [CONNECT MagicBox](https://heycharge.com/products/consumer-gateway) (Consumer Gateway firmware)

## Installation

### HACS
1. Add this repository to HACS as a custom repository (category: Lovelace)
2. Search for "HeyCharge Card" and install
3. Refresh your browser
4. Add the card to your dashboard

### Manual
1. Copy the contents of `dist/` to your `config/www/heycharge-card/` directory
2. Add the resource in Lovelace configuration:
```yaml
resources:
  - url: /local/heycharge-card/heycharge-card.js
    type: module
```
3. Restart Home Assistant and clear browser cache
