import json


def load_config(config_path: str):
    """Loads json config file from string passed"""
    with open(config_path) as config_file:
        config = json.load(config_file)
        return config
