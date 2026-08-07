from fastapi import Header, HTTPException

def verify_token(x_token: str = Header(None)):
    if x_token and x_token != "secret":
        raise HTTPException(status_code=400, detail="X-Token header invalid")
    return x_token
