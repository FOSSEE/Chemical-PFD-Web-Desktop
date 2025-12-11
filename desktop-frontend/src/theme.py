from PyQt5 import QtWidgets
import src.app_state as app_state

from src.fader import ThemeFader

def apply_theme_to_screen(screen, theme=None):
    """Apply theme to one screen by setting bgwidget[theme] property."""
    if theme is None:
        theme = app_state.current_theme
    else:
        app_state.current_theme = theme

    bg = screen.findChild(QtWidgets.QWidget, "bgwidget")
    if bg is not None:
        bg.setProperty("theme", theme)
        bg.style().unpolish(bg)
        bg.style().polish(bg)
        
        # Force update on all children to ensure inherited styles (like [theme="dark"] descendant selectors) apply
        for child in bg.findChildren(QtWidgets.QWidget):
            child.style().unpolish(child)
            child.style().polish(child)
        
        bg.update()


def apply_theme_to_all(theme):
    """Apply theme to all pages in the stacked widget."""
    if app_state.widget is None:
        return

    # Trigger Fade Animation
    # We create the fader on the stacked widget (or current widget)
    # It grabs current state, then we change theme behind it, and it fades out.
    fader = ThemeFader(app_state.widget)
    
    app_state.current_theme = theme
    for i in range(app_state.widget.count()):
        s = app_state.widget.widget(i)
        apply_theme_to_screen(s, theme)
        if hasattr(s, "update_theme_button"):
            s.update_theme_button()

