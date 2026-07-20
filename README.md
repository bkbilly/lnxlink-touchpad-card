# LNXlink Touchpad Card

A virtual touchpad card for Home Assistant that allows you to control mouse movements via LNXlink.

<img width="492" height="262" alt="image" src="https://github.com/user-attachments/assets/a2f12dd7-6891-43c1-93d2-d495726a2c20" />


## Features

- 🖱️ **Virtual Touchpad**: Smooth mouse movement control.
- ✨ **Configurable Sensitivity & Acceleration**: Fine-tune cursor speed and acceleration behavior.
- 👆 **Tap for Left Click**: Single-finger tap maps to left click.
- 🖐️ **Two-Finger Tap for Right Click**: Double-finger tap maps to right click.
- ⏱️ **Drag Mode**: Long press (hold for 300ms by default) to start dragging, with configurable auto-release timeout.
- ↕️ **Two-Finger Scroll**: Vertical scrolling using a two-finger drag gesture with configurable scroll speed and acceleration.
- 📳 **Haptic Feedback**: Vibration on click/drag actions (supported on mobile devices).
- 🎛️ **Visual Editor**: Full Home Assistant UI configuration editor support.
- 📱 **Responsive Input**: Works with both touch devices and mouse pointers.

## Installation

### HACS (Recommended)

1. Open your Home Assistant instance and go to the Home Assistant Community Store (HACS).
2. Click the button below to directly go to the repository in HACS:

   [![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=bkbilly&repository=lnxlink-touchpad-card&category=plugin)

3. Alternatively, click on the three dots in the top right corner of the HACS page and select **Custom repositories**.
4. Paste the URL of this repository: `https://github.com/bkbilly/lnxlink-touchpad-card` and select **Lovelace** / **Dashboard** category.
5. Click **Add** and install the **LnxLink Touchpad Card** plugin.

### Manual Installation

1. Download the `lnxlink-touchpad-card.js` file from the `dist/` directory of this repository.
2. Upload it to your Home Assistant configuration directory under `www/lnxlink-touchpad-card.js`.
3. Add a reference to the card in your dashboard resources config:
   - **Via UI**: Settings -> Dashboards -> Click three dots in top-right -> Resources -> Add Resource -> Set URL as `/local/lnxlink-touchpad-card.js` and Resource Type as `JavaScript Module`.

## Usage

- **Move mouse**: Drag one finger across the touchpad.
- **Left click**: Single tap.
- **Right click**: Two-finger tap.
- **Scroll**: Drag two fingers up or down.
- **Drag**: Long press (hold for 300ms by default), wait for vibration / visual indicator change, then move to drag. Lift finger to stop moving; it remains in drag mode for the duration of `drag_inactivity_timeout` (default 600ms), letting you lift and adjust your finger. Tap once to explicitly release/drop the drag.

## Configuration

### Example YAML Configuration

Here is a complete configuration example including scrolling and click configurations:

```yaml
type: custom:lnxlink-touchpad
coord_entity: text.desktop_linux_mouse_coordinates
sensitivity: 1.0
acceleration: 1.5
movement_threshold: 5
long_press_threshold: 300
drag_inactivity_timeout: 600
scroll_sensitivity: 40
scroll_min_interval: 120
scroll_acceleration: 15
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
scroll_up_action:
  action: perform-action
  perform_action: button.press
  target:
    entity_id: button.desktop_linux_mouse_wheel_up
scroll_down_action:
  action: perform-action
  perform_action: button.press
  target:
    entity_id: button.desktop_linux_mouse_wheel_down
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

### Options

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `coord_entity` | string | **Required** | Entity ID of the `text` or `input_text` entity for mouse coordinates (e.g., `text.desktop_linux_mouse_coordinates`). |
| `sensitivity` | number | `1.0` | Mouse movement sensitivity factor. Range: `0.1` - `5.0`. |
| `acceleration` | number | `1.5` | Mouse movement acceleration factor. Range: `1.0` - `5.0`. |
| `movement_threshold` | number | `5` | Pixels a touch point must move before triggering mouse movement (prevents accidental movement during taps). |
| `long_press_threshold` | number | `300` | Milliseconds to hold for triggering drag mode. |
| `drag_inactivity_timeout` | number | `600` | Milliseconds of inactivity before drag mode is automatically released when fingers are lifted. |
| `scroll_sensitivity` | number | `40` | Scroll sensitivity (pixels of vertical movement needed to trigger a scroll action). |
| `scroll_min_interval` | number | `120` | Minimum milliseconds between scroll actions to prevent scrolling from running away. |
| `scroll_acceleration` | number | `15` | Scroll acceleration scaling factor. Set to `0` to disable scroll acceleration. |
| `tap_action` | Action | `none` | Action to trigger on single tap (Left click). |
| `right_click_action` | Action | `none` | Action to trigger on two-finger tap (Right click). |
| `scroll_up_action` | Action | `none` | Action to trigger when scrolling up. |
| `scroll_down_action` | Action | `none` | Action to trigger when scrolling down. |
| `drag_start_action` | Action | `none` | Action to trigger when entering drag mode. |
| `drag_end_action` | Action | `none` | Action to trigger when exiting drag mode. |

## LNXlink Integration

This card is designed to work with [LNXlink](https://github.com/bkbilly/lnxlink). Make sure you have:

1. **LNXlink installed and configured** on your host machine.
2. The **Mouse module enabled** in your LNXlink configuration.
3. The required entities created in Home Assistant. By default, standard entities created by the Mouse module will be named after your device name (e.g. `desktop_linux`), including:
   - `text.<device_name>_mouse_coordinates`
   - `button.<device_name>_mouse_click`
   - `button.<device_name>_mouse_click_right`
   - `button.<device_name>_mouse_click_left_down`
   - `button.<device_name>_mouse_click_left_up`
   - `button.<device_name>_mouse_wheel_up`
   - `button.<device_name>_mouse_wheel_down`
