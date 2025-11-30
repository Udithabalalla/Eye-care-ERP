@echo off
pip uninstall -y bcrypt passlib
pip install bcrypt==4.1.2
pip install passlib[bcrypt]==1.7.4
echo Bcrypt upgraded successfully!
