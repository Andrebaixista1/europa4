import paramiko
import pathlib
host='85.31.61.242'; user='root'; password='MTi9AiB6v4LNnX3@'
remote_path='/root/apis-laravel-vieiracred/app/Http/Controllers/ConsultaV8Controller.php'
local_path='D:/Projetos/europa4/ConsultaV8Controller.remote.php'
client=paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname=host, username=user, password=password, timeout=20)
sftp=client.open_sftp()
with sftp.open(remote_path,'r') as f:
    data=f.read()
pathlib.Path(local_path).write_bytes(data)
sftp.close()
client.close()
print('downloaded')
