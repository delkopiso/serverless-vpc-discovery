'use strict';

const chai = require('chai');
const AWS = require('aws-sdk-mock');
const testData = require('./test-data.json');
const emptyData = require('./empty-data.json');
const VPCPlugin = require('../index.js');

const expect = chai.expect;

// Used for changing what to test
const vpc = 'ci';
const subnets = [
  'test_subnet_1',
  'test_subnet_2',
  'test_subnet_3',
];
const securityGroups = ['test_group_1'];
const vpcId = 'vpc-test';

// This will create a mock plugin to be used for testing
const constructPlugin = (vpcConfig) => {
  const serverless = {
    service: {
      provider: {
        region: 'us-moon-1',
      },
      custom: {
        vpc: vpcConfig,
      },
    },
    cli: {
      log() {
      },
    },
  };
  return new VPCPlugin(serverless);
};

describe('serverless-vpc-plugin', () => {
  it('registers hooks', () => {
    const plugin = constructPlugin({}, {});
    expect(plugin.hooks['before:deploy:initialize']).to.be.a('function');
  });
});


describe('Given a vpc,', () => {
  it('function updates vpc', () => {
    AWS.mock('EC2', 'describeVpcs', testData);
    AWS.mock('EC2', 'describeSubnets', testData);
    AWS.mock('EC2', 'describeSecurityGroups', testData);

    const plugin = constructPlugin({
      vpcName: vpc,
      subnetNames: subnets,
      securityGroupNames: securityGroups,
    });

    return plugin.updateVpcConfig().then((data) => {
      expect(data).to.eql({
        securityGroupIds: ['sg-test'],
        subnetIds: ['subnet-test-1', 'subnet-test-2', 'subnet-test-3'],
      });
    });
  });

  it('vpc option given does not exist', () => {
    AWS.mock('EC2', 'describeVpcs', emptyData);
    const plugin = constructPlugin({});

    return plugin.getVpcId('not_a_vpc_name').then(() => {
      throw new Error('No error thrown for invalid VPC options');
    }, (err) => {
      expect(err.message).to.equal('Invalid vpc name, it does not exist');
    });
  });

  afterEach(() => {
    AWS.restore();
  });
});

describe('Given valid inputs for ', () => {
  let plugin;

  beforeEach(() => {
    AWS.mock('EC2', 'describeVpcs', testData);
    AWS.mock('EC2', 'describeSecurityGroups', testData);
    AWS.mock('EC2', 'describeSubnets', testData);
    plugin = constructPlugin({});
  });

  it('Subnets', () => plugin.getSubnetIds(vpcId, subnets).then((data) => {
    expect(data[0]).to.equal('subnet-test-1');
  }));

  it('Security Groups', () => plugin.getSecurityGroupIds(vpcId, securityGroups).then((data) => {
    expect(data[0]).to.equal('sg-test');
  }));

  afterEach(() => {
    AWS.restore();
  });
});

describe('Given invalid input for ', () => {
  let plugin;
  beforeEach(() => {
    AWS.mock('EC2', 'describeSecurityGroups', emptyData);
    AWS.mock('EC2', 'describeSubnets', emptyData);
    plugin = constructPlugin({}, {});
  });

  it('Subnets', () => plugin.getSubnetIds(vpcId, ['not_a_subnet']).then(() => {
    throw new Error('Test has failed. Subnets were created with invalid inputs');
  }, (err) => {
    expect(err.message).to.equal('Invalid subnet name, it does not exist');
  }));

  it('Security Groups', () => plugin.getSecurityGroupIds(vpcId, ['not_a_security']).then(() => {
    throw new Error('Test has failed. Security Groups were created with invalid inputs');
  }, (err) => {
    expect(err.message).to.equal('Invalid security group name, it does not exist');
  }));

  afterEach(() => {
    AWS.restore();
  });
});

describe('Catching errors in updateVpcConfig ', () => {
  it('AWS api call describeVpcs fails', () => {
    const plugin = constructPlugin({
      vpcName: vpc,
      subnetNames: subnets,
      securityGroupNames: securityGroups,
    });

    return plugin.updateVpcConfig().then(() => {
      throw new Error('Test has failed. updateVpcConfig did not catch errors.');
    }, (err) => {
      const expectedErrorMessage = "Could not set vpc config. Message: UnknownEndpoint: Inaccessible host: `ec2.us-moon-1.amazonaws.com'. This service may not be available in the `us-moon-1' region.";
      expect(err.message).to.equal(expectedErrorMessage);
    });
  });

  it('Serverless file is configured incorrectly', () => {
    const plugin = constructPlugin({
      securityGroupNames: securityGroups,
    });

    try {
      return plugin.updateVpcConfig().then(() => {
        throw new Error('Test has failed. updateVpcConfig did not catch errors.');
      });
    } catch (err) {
      const expectedErrorMessage = 'Serverless file is not configured correctly. Please see README for proper setup.';
      expect(err.message).to.equal(expectedErrorMessage);
      return true;
    }
  });
});
