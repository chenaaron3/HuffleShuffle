# Mobile Support

## Mobile Landscape Layout

The application supports mobile landscape orientation (< 1024px width, width > height) with a dedicated mobile layout:

- **Tab-based Navigation**: Two tabs accessible via toggle button (left middle)
  - **Dealer Tab**: Full-screen dealer camera view
  - **Betting Tab**: Split view with player seats (top), community cards/hand camera/betting controls (bottom)
- **Responsive Components**:
  - Dealer camera uses `h-full` on mobile, `aspect-video` on desktop
  - Seat cards support `fullHeight` prop for mobile layouts
  - Betting controls extracted to separate component, hidden in dealer tab on mobile
- **Non-invasive Architecture**: Mobile components don't modify desktop components
- **Portrait Mode**: Shows "Rotate Device" message (only landscape supported)

## Mobile Component Organization

All mobile-specific components are organized in `src/components/ui/mobile/`:

- Centralized location for easier maintenance
- Clean separation from desktop components
- Shared index file for convenient imports

Detail per file: [Key components](./key-components.md#mobile-components-srccomponentsuimobile).

## Mobile Considerations

- Tooltips hidden on mobile to prevent Portal positioning issues
- Horizontal scrolling for seats and betting controls when content overflows
- Full-height seat cards on mobile (half screen height)
- Vertical raise controls only shown in betting tab on mobile
