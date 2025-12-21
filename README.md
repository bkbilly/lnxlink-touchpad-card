# LNXlink Touchpad Card

A virtual touchpad card for Home Assistant that allows you to control mouse movements via LNXlink.

<img width="492" height="262" alt="image" src="https://github.com/user-attachments/assets/a2f12dd7-6891-43c1-93d2-d495726a2c20" />


## Features

- 🖱️ Virtual touchpad for mouse control
- ✨ Configurable sensitivity and acceleration
- 👆 Tap for left click
- 🖐️ Two-finger tap for right click
- ⏱️ Long press for drag mode
- 📳 Haptic feedback for interactions (mobile devices)
- 🎛️ Full UI configuration editor
- 📱 Touch and mouse support

## Installation

### HACS

Use this link to directly go to the repository in HACS

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=bkbilly&repository=lnxlink-touchpad-card&category=plugin)

### Basic Card Configuration

Add the card through the UI:
1. Click "Add Card"
2. Search for "LNXlink Touchpad Card"
3. Configure using the visual editor

## Configuration

### Example YAML Configuration
```yaml
type: custom:lnxlink-touchpad
coord_entity: text.desktop_linux_mouse_coordinates
sensitivity: 1
acceleration: 1.5
movement_threshold: 5
long_press_threshold: 300
drag_inactivity_timeout: 600
tap_action:
  action: perform-action
  perform_action: button.press
  target:
    entity_id: button.desktop_linux_mouse_click
  data: {}
right_click_action:
  action: perform-action
  perform_action: button.press
  target:
    entity_id: button.desktop_linux_mouse_click_right
drag_start_action:
  action: perform-action
  perform_action: button.press
  target:
    entity_id: button.desktop_linux_mouse_click_left_down
drag_end_action:
  action: perform-action
  perform_action: button.press
  target:
    entity_id: button.desktop_linux_mouse_click_left_up
```

## Usage

- **Move mouse**: Drag across the touchpad
- **Left click**: Single tap
- **Right click**: Two-finger tap
- **Drag**: Long press (hold for 300ms by default), then move

## LNXlink Integration

This card is designed to work with [LNXlink](https://github.com/bkbilly/lnxlink). Make sure you have:

1. LNXlink installed and configured
2. The required entities created
3. Mouse module enabled in LNXlink

