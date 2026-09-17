import pandas as pd
import pytest

from scripts.import_supplier import normalise


def test_normalise_deduplicates_sku_and_cleans_values():
    raw = pd.DataFrame([
        {"Brand": " Maison  Test ", "Name": "No.  1", "SKU": "A", "Price": "10"},
        {"Brand": "Maison Test", "Name": "No. 1", "SKU": "A", "Price": "12"},
    ])
    result = normalise(raw)
    assert len(result) == 1
    assert result.iloc[0].brand == "Maison Test"
    assert result.iloc[0].price == 12


def test_normalise_rejects_missing_columns():
    with pytest.raises(ValueError, match="Missing required columns"):
        normalise(pd.DataFrame([{"name": "Incomplete"}]))


def test_normalise_removes_invalid_rows():
    raw = pd.DataFrame([{"brand": "B", "name": "F", "sku": "S", "price": -1}])
    assert normalise(raw).empty
