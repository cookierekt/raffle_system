#!/usr/bin/env python3
"""
Test the API endpoints directly
"""
import requests
import json

# Test login
login_data = {
    "email": "homecare@homeinstead.com",
    "password": "Homeinstead3042"
}

print("Testing login...")
try:
    response = requests.post('http://127.0.0.1:5000/login', json=login_data)
    print(f"Login status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        if data.get('success'):
            token = data.get('token')
            print(f"Login successful! Token: {token[:20]}...")
            
            # Test get employees
            print("\nTesting get employees...")
            headers = {'Authorization': f'Bearer {token}'}
            emp_response = requests.get('http://127.0.0.1:5000/api/employees', headers=headers)
            print(f"Employees status: {emp_response.status_code}")
            
            if emp_response.status_code == 200:
                emp_data = emp_response.json()
                print(f"Employees response: {json.dumps(emp_data, indent=2)}")
            else:
                print(f"Employees error: {emp_response.text}")
                
            # Test add employee
            print("\nTesting add employee...")
            add_data = {"name": "API Test Employee"}
            add_response = requests.post('http://127.0.0.1:5000/api/employee', 
                                       json=add_data, headers=headers)
            print(f"Add employee status: {add_response.status_code}")
            print(f"Add employee response: {add_response.text}")
            
        else:
            print(f"Login failed: {data}")
    else:
        print(f"Login failed with status: {response.status_code}")
        print(f"Response: {response.text}")
        
except Exception as e:
    print(f"Error testing API: {e}")
    print("Make sure the Flask app is running on localhost:5000")