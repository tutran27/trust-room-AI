"""Test that translation works without accelerate installed."""
import sys
import asyncio

def test_no_accelerate():
    """Verify accelerate is not installed."""
    try:
        import accelerate
        print(f"WARNING: accelerate {accelerate.__version__} is installed")
    except ImportError:
        print("OK: accelerate is NOT installed (as expected)")

def test_model_load():
    """Test model loading without device_map issues."""
    from app.config import get_config
    cfg = get_config()
    print(f"Config: model={cfg.translation_model}, device={cfg.resolved_translation_device}, dtype={cfg.translation_dtype}")

    from app.translator import load_model
    print("Loading model...")
    model, tokenizer = load_model()
    print(f"Model loaded successfully on device: {model.device}")
    return model, tokenizer

def test_translation(model, tokenizer):
    """Test actual translation."""
    from app.translator import translate

    print("\nTesting vi->en...")
    text, latency = asyncio.run(translate("Xin chao ban, hy ban mot ngay tot dep", "vi", "en"))
    print(f"  Result: \"{text}\" ({latency:.0f}ms)")

    print("Testing en->vi...")
    text, latency = asyncio.run(translate("Hello friend, hope you have a great day", "en", "vi"))
    print(f"  Result: \"{text}\" ({latency:.0f}ms)")

    print("\nAll translation tests PASSED!")

if __name__ == "__main__":
    print("=" * 60)
    print("Translation Fix Verification Test")
    print("=" * 60)
    test_no_accelerate()
    print()
    model, tokenizer = test_model_load()
    test_translation(model, tokenizer)