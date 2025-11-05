import os
import requests
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class GeoServerClient:
    """Client for GeoServer REST API operations."""
    
    def __init__(self):
        self.base_url = os.getenv('GEOSERVER_URL', 'http://localhost:8080/geoserver')
        self.username = os.getenv('GEOSERVER_USER', 'admin')
        self.password = os.getenv('GEOSERVER_PASSWORD', 'geoserver123')
        self.auth = (self.username, self.password)
        
    async def create_workspace(self, workspace_name: str) -> bool:
        """Create a workspace in GeoServer."""
        try:
            url = f"{self.base_url}/rest/workspaces"
            data = f'<workspace><name>{workspace_name}</name></workspace>'
            
            response = requests.post(
                url,
                data=data,
                auth=self.auth,
                headers={'Content-Type': 'text/xml'}
            )
            
            # 201 = created, 409 = already exists
            return response.status_code in [201, 409]
            
        except Exception as e:
            logger.error(f"Failed to create workspace {workspace_name}: {e}")
            return False
    
    async def create_coverage_store(self, layer_name: str, file_path: str, workspace: str = 'escap') -> bool:
        """Create a coverage store for raster data."""
        try:
            # Ensure workspace exists
            await self.create_workspace(workspace)
            
            store_name = f"{layer_name}_store"
            url = f"{self.base_url}/rest/workspaces/{workspace}/coveragestores"
            
            # Create coverage store
            data = f'''
            <coverageStore>
                <name>{store_name}</name>
                <type>GeoTIFF</type>
                <url>file://{file_path}</url>
                <enabled>true</enabled>
            </coverageStore>
            '''
            
            response = requests.post(
                url,
                data=data,
                auth=self.auth,
                headers={'Content-Type': 'text/xml'}
            )
            
            if response.status_code not in [201, 409]:
                logger.error(f"Failed to create coverage store: {response.status_code} - {response.text}")
                return False
            
            # Create coverage layer
            coverage_url = f"{url}/{store_name}/coverages"
            coverage_data = f'''
            <coverage>
                <name>{layer_name}</name>
                <title>{layer_name}</title>
                <enabled>true</enabled>
            </coverage>
            '''
            
            coverage_response = requests.post(
                coverage_url,
                data=coverage_data,
                auth=self.auth,
                headers={'Content-Type': 'text/xml'}
            )
            
            return coverage_response.status_code in [201, 409]
            
        except Exception as e:
            logger.error(f"Failed to create coverage store {layer_name}: {e}")
            return False
    
    async def create_vector_layer(self, layer_name: str, file_path: str, workspace: str = 'escap') -> bool:
        """Create a vector layer from shapefile/GeoJSON."""
        try:
            # Ensure workspace exists
            await self.create_workspace(workspace)
            
            store_name = f"{layer_name}_store"
            url = f"{self.base_url}/rest/workspaces/{workspace}/datastores"
            
            # Determine file type
            file_ext = file_path.lower().split('.')[-1]
            if file_ext == 'shp':
                store_type = 'Shapefile'
                url_param = f"file://{file_path}"
            elif file_ext == 'geojson':
                store_type = 'GeoJSON'
                url_param = f"file://{file_path}"
            else:
                logger.error(f"Unsupported vector format: {file_ext}")
                return False
            
            # Create datastore
            data = f'''
            <dataStore>
                <name>{store_name}</name>
                <type>{store_type}</type>
                <connectionParameters>
                    <url>{url_param}</url>
                </connectionParameters>
                <enabled>true</enabled>
            </dataStore>
            '''
            
            response = requests.post(
                url,
                data=data,
                auth=self.auth,
                headers={'Content-Type': 'text/xml'}
            )
            
            if response.status_code not in [201, 409]:
                logger.error(f"Failed to create datastore: {response.status_code} - {response.text}")
                return False
            
            # Create feature type (layer)
            layer_url = f"{url}/{store_name}/featuretypes"
            layer_data = f'''
            <featureType>
                <name>{layer_name}</name>
                <title>{layer_name}</title>
                <enabled>true</enabled>
            </featureType>
            '''
            
            layer_response = requests.post(
                layer_url,
                data=layer_data,
                auth=self.auth,
                headers={'Content-Type': 'text/xml'}
            )
            
            return layer_response.status_code in [201, 409]
            
        except Exception as e:
            logger.error(f"Failed to create vector layer {layer_name}: {e}")
            return False
    
    async def delete_layer(self, layer_name: str, workspace: str = 'escap') -> bool:
        """Delete a layer from GeoServer."""
        try:
            url = f"{self.base_url}/rest/workspaces/{workspace}/layers/{layer_name}"
            
            response = requests.delete(url, auth=self.auth)
            return response.status_code in [200, 404]  # 404 = already deleted
            
        except Exception as e:
            logger.error(f"Failed to delete layer {layer_name}: {e}")
            return False
    
    async def get_layer_info(self, layer_name: str, workspace: str = 'escap') -> Optional[Dict[str, Any]]:
        """Get information about a layer."""
        try:
            url = f"{self.base_url}/rest/workspaces/{workspace}/layers/{layer_name}.json"
            
            response = requests.get(url, auth=self.auth)
            if response.status_code == 200:
                return response.json()
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get layer info {layer_name}: {e}")
            return None