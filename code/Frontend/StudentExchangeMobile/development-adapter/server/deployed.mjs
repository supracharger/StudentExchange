import { loadDeploymentConfig } from './deployment-config.mjs'
import { createWebsiteServer } from './app.mjs'

try {
  const config = loadDeploymentConfig()
  if (process.argv.includes('--check-config')) {
    // Parsing only: no sockets, health probes, login or backend requests.
    console.log('Deployment configuration valid. Backend traffic: ' + (config.trafficPolicy.enabled ? 'enabled' : 'disabled'))
  } else {
    const server = createWebsiteServer(config)
    server.maxConnections=128
    server.maxHeadersCount=100
    server.maxRequestsPerSocket=100
    server.on('error',()=>{console.error('Adapter server failed.');process.exitCode=1})
    server.listen(config.port,'0.0.0.0',()=>console.log('Adapter listening. Backend traffic: ' + (config.trafficPolicy.enabled ? 'enabled' : 'disabled')))
    for (const signal of ['SIGINT','SIGTERM']) process.once(signal,()=>{
      server.close()
      server.closeIdleConnections()
      const deadline=setTimeout(()=>{server.closeAllConnections()},config.timeoutMs+5000)
      deadline.unref()
    })
  }
} catch (error) {
  // Configuration messages never echo environment values or credentials.
  console.error(error.message)
  process.exitCode=1
}
