import re

files = [
    r"c:\Users\abhay\Downloads\beyond-eta-main\beyond-eta-main\frontend\src\components\Dashboard.js",
    r"c:\Users\abhay\Downloads\beyond-eta-main\beyond-eta-main\frontend\src\components\SearchPanel.js",
    r"c:\Users\abhay\Downloads\beyond-eta-main\beyond-eta-main\backend\server.py",
    r"c:\Users\abhay\Downloads\beyond-eta-main\beyond-eta-main\backend\OLLAMA_SETUP.md"
]

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Dashboard
    content = re.sub(r"const MAPBOX_TOKEN = 'pk\.eyJ1IjoiYWJoaWkwMDciLCJhIjoiY21ua3AwM2dmMHl6NzJwcXU2NXpvZm85cSJ9\.dEjR9qo-DWemfh--J4PeRA';",
                     "const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;", content)
    # SearchPanel
    content = re.sub(r"const MAPBOX_TOKEN = 'pk\.eyJ1IjoiYWJoaWkwMDciLCJhIjoiY21uMWRrdms4MGxqbzJyc2p4YmF5YzluaSJ9\.OjJeU8jXd9Pi_xRb7wUYuw';",
                     "const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;", content)
    # server.py mapbox
    content = re.sub(r"mapbox_token = os\.getenv\('MAPBOX_TOKEN',\s*['\"]pk\.eyJ1IjoiYWJoaWkwMDciLCJhIjoiY21ua3AwM2dmMHl6NzJwcXU2NXpvZm85cSJ9\.dEjR9qo-DWemfh--J4PeRA['\"][\s\n]*\)",
                     "mapbox_token = os.getenv('MAPBOX_TOKEN')", content)
    # server.py openweather
    content = re.sub(r"api_key = os\.getenv\('OPENWEATHER_API_KEY',\s*['\"]d6f6e6f06adb4c7e05d3a9c7e5f9e8d3['\"][\s\n]*\)",
                     "api_key = os.getenv('OPENWEATHER_API_KEY')", content)
    # OLLAMA_SETUP
    content = re.sub(r"MAPBOX_TOKEN=pk\.eyJ1IjoiYWJoaWkwMDciLCJhIjoiY21uMWRrdms4MGxqbzJyc2p4YmF5YzluaSJ9\.OjJeU8jXd9Pi_xRb7wUYuw",
                     "MAPBOX_TOKEN=YOUR_MAPBOX_TOKEN_HERE", content)
                     
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

print("Replacement successful")
