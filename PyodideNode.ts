import { INodeType, INodeTypeDescription, INodeExecutionData, IExecuteFunctions, NodeConnectionType } from 'n8n-workflow';

// Cache pyodide instance to avoid reloading
let pyodideInstance: any = null;

export class PyodideNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Pyodide',
		name: 'pyodide',
		group: ['transform'],
		version: 1,
		description: 'Executes Python code using Pyodide. Data from previous nodes is available as input_data.',
		defaults: {
			name: 'Pyodide',
			color: '#4B8BBE',
		},
		icon: 'file:python-com.svg',
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		properties: [
			{
				displayName: 'Python Code',
				name: 'pythonCode',
				type: 'string',
				typeOptions: {
					rows: 10,
				},
				default: `# Access input data from previous nodes
# input_data contains the JSON data
result = input_data
# You can also set 'output' variable
# output = {"processed": input_data}`,
				description: 'Python code to execute. Use "input_data" to access data from previous nodes. Return a value or set "output" variable.',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const results: INodeExecutionData[] = [];

		// Initialize pyodide once and cache it
		if (!pyodideInstance) {
			const pyodideModule = await import('pyodide');
			pyodideInstance = await pyodideModule.loadPyodide();
		}

		for (let i = 0; i < items.length; i++) {
			const pythonCode = this.getNodeParameter('pythonCode', i) as string;
			const inputData = items[i].json;

			let output: any = null;
			let error = '';

			try {
				// Safely pass JSON data to Python using pyodide's built-in method
				pyodideInstance.globals.set('input_data', inputData);

				// Execute the Python code
				const result = await pyodideInstance.runPythonAsync(pythonCode);

				// Handle different return types
				if (result !== undefined) {
					output = result;
				} else {
					// If no return value, try to get 'output' variable
					try {
						output = pyodideInstance.globals.get('output');
					} catch {
						output = null;
					}
				}
			} catch (err) {
				error = err instanceof Error ? err.message : String(err);
			}

			results.push({
				json: {
					output,
					error,
					...(error ? {} : { input: inputData }), // Include input for reference when successful
				},
			});
		}

		return [results];
	}
}