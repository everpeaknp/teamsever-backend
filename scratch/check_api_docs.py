import json

def check_tables_security(file_path):
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    # Find the "api" folder, then "tables" folder
    api_folder = next((item for item in data['item'] if item['name'] == 'api'), None)
    if not api_folder:
        print("API folder not found")
        return
    
    tables_folder = next((item for item in api_folder['item'] if item['name'] == 'tables'), None)
    if not tables_folder:
        print("Tables folder not found")
        return

    def process_item(item, path=""):
        full_path = f"{path} / {item['name']}" if path else item['name']
        
        if 'item' in item:
            for sub_item in item['item']:
                process_item(sub_item, full_path)
        else:
            # This is an endpoint
            responses = item.get('response', [])
            has_403 = any(str(resp.get('code')) == '403' for resp in responses)
            if not has_403:
                print(f"[MISSING 403] {full_path}")
            else:
                # Check message
                forbidden_resp = next((resp for resp in responses if str(resp.get('code')) == '403'), None)
                if forbidden_resp:
                    name = forbidden_resp.get('name', '')
                    expected = "Forbidden. User is not a member of the space containing this table."
                    if name != expected:
                        print(f"[WRONG MESSAGE] {full_path}: '{name}'")

    process_item(tables_folder)

if __name__ == "__main__":
    check_tables_security('api_teamsever.json')
