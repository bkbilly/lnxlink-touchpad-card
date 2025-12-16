# LNXlink Touchpad Card

A virtual touchpad card for Home Assistant that allows you to control mouse movements via LnxLink.

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

### HACS (Recommended)

1. Open HACS in your Home Assistant instance
2. Click on the 3 dots in the top right corner
3. Select "Custom repositories"
4. Add `https://github.com/bkbilly/lnxlink-touchpad-card` as a "Dashboard" repository
5. Click "Install"

### Basic Card Configuration

Add the card through the UI:
1. Click "Add Card"
2. Search for "LnxLink Touchpad"
3. Configure using the visual editor

## Configuration

### Example YAML Configuration
```yaml
type: custom:lnxlink-touchpad
coord_entity: text.desktop_linux_mouse_coordinates
sensitivity: 1
acceleration: 1.5
long_press_threshold: 500
movement_threshold: 5
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
- **Drag**: Long press (hold for 500ms by default), then move

## LnxLink Integration

This card is designed to work with [LnxLink](https://github.com/bkbilly/lnxlink). Make sure you have:

1. LnxLink installed and configured
2. The required entities created
3. Mouse module enabled in LnxLink

