from flask import Flask , request , jsonify
from flask_cors import CORS
from login import handle_login 
import time 
from save_session import save
from model import train_and_predict
from focus_detection import init_focus_routes

app=Flask(__name__)
CORS(app)

init_focus_routes(app)



@app.route('/save-session', methods=['POST'])
def save_session():
    data=request.get_json()
    print('got data in save-session',data)
    res=save(data)
    return res


@app.route('/submit', methods=["POST"])
def submit_form():
    start = time.time()

    print('📥 /submit hit')
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    print('Received', username, 'password')

    result = handle_login(username, password)

    end = time.time()
    print(f"⏱️ Time taken: {end - start:.3f} seconds")

    return jsonify(result)

@app.route('/duration',methods=['POST'])
def timer_duration():
    try:
        data=request.get_json()
        print('got req data',data)
        res=train_and_predict(data['username'],data['date'])
        return jsonify({'duration':res})
    except Exception as e:
        print("Error in /duration:", e)
        return jsonify({"error": str(e)}), 500


if __name__=="__main__":
    app.run(debug=True)




