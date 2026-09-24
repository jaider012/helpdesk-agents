// Test preload: TCP connections never complete, like a gateway that drops the handshake.
import net from 'node:net';

net.connect = () => new net.Socket();
