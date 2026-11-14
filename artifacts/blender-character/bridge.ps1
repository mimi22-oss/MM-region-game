param([string]$CodePath)
$ErrorActionPreference='Stop'
$client=[Net.Sockets.TcpClient]::new('127.0.0.1',9876)
try {
 $stream=$client.GetStream()
 $stream.ReadTimeout=180000
 $payload=@{type='execute';strict_json=$true;code=[IO.File]::ReadAllText($CodePath)} | ConvertTo-Json -Compress
 $bytes=[Text.Encoding]::UTF8.GetBytes($payload+[char]0)
 $stream.Write($bytes,0,$bytes.Length)
 $buffer=New-Object byte[] 65536
 $reply=[Text.StringBuilder]::new()
 do {$n=$stream.Read($buffer,0,$buffer.Length); if($n -eq 0){break}; [void]$reply.Append([Text.Encoding]::UTF8.GetString($buffer,0,$n))} while($reply.ToString().IndexOf([char]0) -lt 0)
 $reply.ToString().TrimEnd([char]0)
} finally {$client.Dispose()}
